var CSSLint = require('csslint').CSSLint;
var smartyHelper = require('./smarty-helper');
var collector = require('./collector');
var utils = require('./utils');

var currentFileName = 'unknown-file';

CSSLint.addRule({
  //rule information
  id: 'global-selectors',
  name: 'Disallow global tagName selecters without any modifiers.',
  desc: 'Probably be harmful when group working.',
  browsers: "All",

  //initialization
  init: function(parser, reporter) {
    "use strict";
    var rule = this;

    parser.addListener("startrule", function(event) {
      var selectors = event.selectors;
      for (var i=0; i<selectors.length; ++i){
        var selector = selectors[i],
            parts = selector.parts;
        if (parts.length > 0){
          var part = parts[0];
          if (part.type === parser.SELECTOR_PART_TYPE &&
              part.elementName !== null){
            // 选择器第一段是元素名
            var modifiers = part.modifiers;
            var isGlobalElementSelector = true;
            if (modifiers && modifiers.length > 0){
              for (var k=0; k<modifiers.length; ++k){
                var modifier = modifiers[k], type = modifier.type;
                if (type !== 'pseudo'){
                  if (type === 'attribute' && part.elementName.text === 'input'){
                    if (!modifier.text.match(/^\[type/)){
                      isGlobalElementSelector = false;
                    }
                  }else{
                    isGlobalElementSelector = false;
                  }
                }
              }
            }
            if (isGlobalElementSelector){
              var msg = 'Unsafe global tagName selector `' + selector.text + '`';
              if (selectors.length > 1){
                msg += ' in `' + selectors.map(function(sel){
                  return sel.text;
                }).join(', ') + '`.';
              }
              reporter.report(msg, selector.line, selector.col, rule);
            }
          }
        }
      }
    });
  }
});
CSSLint.addRule({
  id: 'absolute-url-protocal',
  name: 'Absolute protocal in URLs may be not compatible with HTTP/HTTPS.',
  desc: 'Warn when detected URLs with absolute protocol `http`.',
  browsers: 'All',
  init: function(parser, reporter){
    var rule = this;

    parser.addListener('property', function(event){
      var parts = event.value.parts;
      for (var i=0; i<parts.length; ++i){
        var part = parts[i];
        if (part.type === 'uri'){
          var url = part.uri;
          if (url.indexOf('http') == 0){
            var urlShort = url.length > 20 ? (url.substr(0, 18) + '..') : url;
            var msg = "URL '"+urlShort+"' may be not compatible with HTTP/HTTPS.";
            //reporter.report(msg, part.line, part.col, rule);
          }
        }
      }
    });
  }
});
CSSLint.addRule({
  id: 'collect-ids-and-classes',
  name: '',
  desc: '',
  browsers: 'All',
  init: function(parser, reporter){
    var rule = this;
    parser.addListener('startrule', function(event){
      var selectors = event.selectors;
      for (var i=0; i<selectors.length; ++i){
        var selector = selectors[i],
            parts = selector.parts;
        for (var j=0; j<parts.length; ++j){
          var part = parts[j];
          if (part.type === parser.SELECTOR_PART_TYPE){
            var modifiers = part.modifiers;
            for (var k=0; k < modifiers.length; k++){
              var mod = modifiers[k];
              if (mod.type === 'id' || mod.type === 'class'){
                var group = (mod.type === 'id' ? 'ids' : 'classes');
                collector.pushUniq('css-' + group, mod.toString(), currentFileName);
              }
              //console.log("    Modifier: " + part.modifiers[k].toString() + ' (' + part.modifiers[k].type + ')');
            }
          }
        }
      }
    });
  }
});

/**
 * Returns a ruleset object based on the CLI options.
 * @param options {Object} The CLI options.
 * @param ruleset {Object} The Ruleset to gather.
 * @return {Object} A ruleset object.
 */
function gatherRules(options, ruleset){
  var warnings = options.rules || options.warnings,
      errors = options.errors;

  if (warnings){
    ruleset = ruleset || {};
    warnings.forEach(function(value){
      ruleset[value] = 1;
    });
  }

  if (errors){
    ruleset = ruleset || {};
    errors.forEach(function(value){
      ruleset[value] = 2;
    });
  }

  return ruleset;
}

/**
 * Filters out rules using the ignore command line option.
 * @param options {Object} the CLI options
 * @return {Object} A ruleset object.
 */
function filterRules(options) {
  var ignores = options.ignores,
      blames = options.blames || [],
      ruleset = CSSLint.getRuleset();
  var blamesDict = {};
  blames.forEach(function(rule){
    blamesDict[rule] = 1;
  });

  if (ignores) {
    ignores.forEach(function(value){
      if (value in blamesDict){
        return; // 如果规则在blame列表里，那么ignore就无效
      }
      ruleset[value] = 0;
    });
  }

  return ruleset;
}

function cleanSmarty(content, conf, reporter, line, col){
  var result = smartyHelper.clean(content, line, col);
  result.warnings.forEach(reporter.warn, reporter);
  result.errors.forEach(reporter.error, reporter);

  if (!conf.allowSmartyInCSS){
    result.pairs.forEach(function(pair){
      reporter.warn({
        module: 'csslint',
        code: 'smarty-code',
        message: 'Smarty code found within CSS code.',
        line: pair.line,
        col: pair.col
      });
    });
  }
  return result.code;
}

module.exports = function(content, conf, reporter, lineOffset, charOffset){
  if (!content){
    content = ' '; // 空文件很容易造成CSSLINT有问题，很奇怪
  }
  lineOffset = lineOffset || 0;
  charOffset = charOffset || 0;

  currentFileName = conf.subpath;

  var csslintConf = conf.csslint;
  var rules = filterRules(csslintConf);
  rules = gatherRules(csslintConf, rules);

  content = cleanSmarty(content, conf, reporter, lineOffset, charOffset);

  var result = CSSLint.verify(content, rules);
  result.messages.forEach(function(msg){
    var line = msg.line + lineOffset;
    var col = msg.col + charOffset;
    var method = msg.type === 'error' ? 'error' : 'warn';
    var message = msg.message;
    switch(msg.type){
      case 'error':
        if (conf.csslint.ignores.indexOf('errors') !== -1){
          return;
        }
        message = message.replace(/(( )?at)? line (\d+), col (\d+)\.$/, '.');
        break;
      default:
        break;
    }
    reporter[method]({
      module: 'csslint',
      code: msg.rule.id,
      message: message,
      line: line,
      col: col
    });
  });

  return result;
};

module.exports.mergeSetting = function(one, another){
  one = one || {};
  one.ignores = one.ignores || [];
  one.blames = one.blames || [];
  if (another){
    var anotherIgnores = another.ignores || [];
    one.ignores = one.ignores.concat(anotherIgnores);

    var anotherBlames = another.blames || [];
    one.blames = one.blames.concat(anotherBlames);
  }
  return one;
};
