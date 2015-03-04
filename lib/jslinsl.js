var messages = require('jshint/src/messages');
var smartyHelper = require('./smarty-helper');
var JSHINT = require('jshint').JSHINT;
var utils = require('./utils');

var extendWarnings = {
  W801: "Unsafe common resource access '{a}'.",
  W802: "URL '{a}' may be not compatible with HTTP/HTTPS."
};
for (var code in extendWarnings){
  var desc = extendWarnings[code];
  messages.warnings[code] = { code: code, desc: desc };
}

var blacklist = [
  'localStorage',
  'document.cookie',
  'location.hash'
];

var mod = function(linter){
  var q2 = [];
  linter.on('Identifier', function(data){
    var name = data.name,
        warn = false;
    if (blacklist.indexOf(name) >= 0){
      warn = name;
    }

    q2.push(name);
    if (q2.length > 2) q2.shift();
    var name2 = q2.join('.');
    if (blacklist.indexOf(name2) >= 0){
      warn = name2;
    }

    if (warn){
      linter.warn('W801', {
        line: data.line,
        char: data.char,
        data: [ warn ]
      });
    }
  });
};

JSHINT.addModule(mod);


var mod2 = function(linter){
  linter.on('String', function(data){
    var url = data.value;
    if (url.indexOf('http') == 0){
      var urlShort = url.length > 20 ? (url.substr(0, 18) + '..') : url;
      linter.warn('W802', {
        line: data.line,
        char: data.char,
        data: [ urlShort ]
      });
    }
  });
};
JSHINT.addModule(mod2);

function cleanSmarty(content, conf, reporter, line, col){
  var result = smartyHelper.clean(content, line, col);
  result.warnings.forEach(reporter.warn, reporter);
  result.errors.forEach(reporter.error, reporter);

  if (!conf.allowSmartyInJS){
    result.pairs.forEach(function(pair){
      reporter.warn({
        module: 'jshint',
        message: 'Smarty code found within JavaScript code.',
        code: 'W800',
        line: pair.line,
        col: pair.col
      });
    });
  }
  return result.code;
}

/*
var i18n = require('./jslinsl-i18n');
for (var key in messages.warnings){
  if (key in i18n.warnings){
    messages.warnings[key].desc = i18n.warnings[key];
  }
}
for (var key in messages.errors){
  if (key in i18n.errors){
    messages.errors[key].desc = i18n.errors[key];
  }
}
*/

module.exports = function(content, conf, reporter, lineOffset, charOffset){
  lineOffset = lineOffset || 0;
  charOffset = charOffset || 0;

  content = cleanSmarty(content, conf, reporter, lineOffset, charOffset);
  // utils.debug('------------', conf.subpath, lineOffset, charOffset);
  // utils.debug(content);
  // utils.debug('-----------');
  var result = JSHINT(content, conf.jshint.rules);
  if(!result){
    var errors = JSHINT.data().errors;
    for(var i = 0; i<errors.length; i++){
      var err = errors[i];
      if (!err) continue;
      var line = err.line + lineOffset;
      var col = err.character + charOffset;
      var method = err.code[0] === 'E' ? 'error' : 'warn';
      reporter[method]({
        module: 'jshint',
        code: err.code,
        message: err.reason,
        line: line,
        col: col
      });
    }
  }
  return result;
};

module.exports.mergeSetting = function(one, another){
  one = one || {};
  one.rules = one.rules || {};
  if (another){
    utils.extend(one.rules, another.rules);
  }
  return one;
};
