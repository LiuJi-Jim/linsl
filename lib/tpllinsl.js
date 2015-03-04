var htmlparser = require('htmlparser2');
var jslinsl = require('./jslinsl');
var csslinsl = require('./csslinsl');
var utils = require('./utils');
var smartyHelper = require('./smarty-helper');

module.exports = function(content, conf, reporter, callback){
  var code = content;
  var inTag = false;
  var scripts = [],
      styles = [],
      temparr = [];
  var index = 0;
  var startOffset;

  var parser = new htmlparser.Parser({
    onopentag: function(name, attrs) {
      if (name === 'a' || name === 'img'){
        var url = name === 'a' ? attrs.href : attrs.src;
        if (url && url.indexOf('http') == 0){
          var fragment = code.slice(0, parser.startIndex + 1);
          var matches = fragment.match(utils.reLineBreaker) || '';
          //temparr.lineOffset = matches.length;
          var lineOffset = matches.length;
          var match = code.substring(parser.startIndex, parser.endIndex + 1);
          var charOffset = match.indexOf(url) 
                           + parser.startIndex
                           - fragment.lastIndexOf('\n'); // 好像代价很大的样子……咋办
          var urlShort = url.length > 20 ? (url.substr(0, 18) + '..') : url;
          reporter.warn({
            module: 'tpllinsl',
            message: "URL '"+urlShort+"' may be not compatible with HTTP/HTTPS.",
            code: 'W802',
            line: lineOffset,
            col: charOffset
          });
        }
      }
      if (name === 'meta'){
        if (attrs['http-equiv'] && attrs['http-equiv'].toLowerCase() === 'content-type'){
          var content = attrs.content || '';
          if (!content.match(/charset=utf-8/i)){
            // TODO make warning
          }
        }
      }
      if (name === 'script') {
        if (attrs.type && !/text\/javascript/.test(attrs.type.toLowerCase())){
          return;
        }
        if (attrs.src){
          return; // maybe harmful
        }
        inTag = 'script';
      }
      if (name === 'style'){
        inTag = 'style';
      }

      if (inTag){
        temparr.length = 0;

        var fragment = code.slice(0, parser.endIndex);
        var matches = fragment.match(utils.reLineBreaker) || '';
        temparr.lineOffset = matches.length;

        startOffset = null;
      }
    },
    ontext: function(data) {
      var lines = data.split(utils.reLineBreaker);

      // 这里暂时注释掉了列号精简，因为不需要美化代码，这样做节省一点逻辑吧
      // if (!startOffset) {
      //   lines.some(function (line) {
      //     if (!line) return;
      //     startOffset = /^(\s*)/.exec(line)[1];
      //     return true;
      //   });
      // }

      // check for startOffset again to remove leading white space from first line
      // if (startOffset) {
      //   lines = lines.map(function (line) {
      //     return line.replace(startOffset, "");
      //   });
      //   data = lines.join("\n");
      // }
      data = lines.join('\n');

      temparr.push(data);
    },
    onclosetag: function(tagname) {
      var code = temparr.join('');
      var heading = (code.match(/^\s+/g) || []).join(''),
          headingLines = (heading.match(utils.reLineBreaker) || []).join('');

      var elem = {
        code: code.trim(),
        lineOffset: temparr.lineOffset + headingLines.length,
        charOffset: (startOffset || '').length
        //startOffset: (startOffset || '').length
      };

      if (inTag === 'script'){
        scripts.push(elem);
      }
      if (inTag === 'style'){
        styles.push(elem);
      }

      inTag = false;
      index = parser.startIndex;
      startOffset = null;
    },
    onend: function(){
      scripts.forEach(function(tag){
        jslinsl(tag.code, conf, reporter, tag.lineOffset, tag.charOffset);
      });
      styles.forEach(function(tag){
        csslinsl(tag.code, conf, reporter, tag.lineOffset, tag.charOffset);
      });

      callback();
    }
  });

  parser.write(content);
  parser.end();
};

module.exports.mergeSetting = function(one, another){
  one = one || {

  };
  return utils.extend({}, one, another);
};
