var utils = require('./utils');

var errorDict = {
  E001: "Can't find close tag.",
  E002: "Can't find open tag."
};
var warningDict = {
  W001: "Can't find open tag.",
  //W002: "Delimiter nested within delimiters."
  W002: "Smarty tag nesting."
};

function comparePair(a, b){
  return a.startIndex - b.startIndex;
}

var Smarty = module.exports = exports = {
  leftDelimiter: '{%',
  rightDelimiter: '%}',
  errors: errorDict,
  warnings: warningDict
};

var match = Smarty.match = function(code, lineOffset, charOffset){
  var offset = new utils.OffsetCounter(lineOffset, charOffset);
  var stack = [], qleft = [], qright = [],
      pairs = [],
      errors = [], warnings = [];
  function report(arr, code, msg){
    arr.push({
      module: 'smarty',
      code: code,
      message: msg,
      line: offset.line,
      col: offset.col
    });
  }
  function warn(code){
    report(warnings, code, warningDict[code]);
  }
  function error(code){
    report(errors, code, errorDict[code]);
  }
  for (var i=0, len=code.length; i<len; ++i){
    offset.columnCounter++;
    var ch = code.charAt(i);
    if (utils.reLineBreaker.test(ch)){
      offset.lineCounter++;
      offset.columnCounter = 1;
    }
    qleft.push(ch);
    qright.push(ch);
    if (qleft.length > Smarty.leftDelimiter.length) qleft.shift();
    if (qright.length > Smarty.rightDelimiter.length) qright.shift();

    if (qleft.length === Smarty.leftDelimiter.length &&
        qleft.join('') === Smarty.leftDelimiter){
      var startIndex = i - qleft.length + 1; // 左定界符起始位置
      stack.push({
        depth: stack.length,
        startIndex: startIndex,
        line: offset.line,
        col: offset.col
      });
      if (stack.length > 1){
        warn('W002');
      }
    }
    if (qright.length === Smarty.rightDelimiter.length &&
        qright.join('') === Smarty.rightDelimiter){
      var endIndex = i; // 右定界符结束位置
      if (stack.length > 0){
        var tag = stack.pop();
        tag.endIndex = i;
        pairs.push(tag);
      }else{
        //error('E002');
        warn('W001');
      }
    }
  }
  while (stack.length > 0){
    var tag = stack.pop();
    error('E001');
  }

  return {
    pairs: pairs,
    errors: errors,
    warnings: warnings
  };
};

var preprocess = Smarty.preprocess = function(code, replace){
  replace = replace || false;
  var result = match(code);
};
var clean = Smarty.clean = function(code, lineOffset, charOffset){
  var result = match(code, lineOffset, charOffset);
  var pairs = utils.arrClone(result.pairs);
  var codeReplace = code;

  var outerPairs = pairs.filter(function(tag){
    return tag.depth === 0; // 因为层级关系的存在只用替换第一层，里面的东西也换掉了，不然的话反而更麻烦
  });
  outerPairs.sort(comparePair);

  for (var i=outerPairs.length-1; i>=0; --i){
    var tag = outerPairs[i];
    var rep = (new Array(tag.endIndex - tag.startIndex + 2)).join(' ');
    //var rep = '';
    codeReplace = codeReplace.slice(0, tag.startIndex) + rep + codeReplace.slice(tag.endIndex + 1);
  }
  return {
    code: codeReplace,
    pairs: pairs,
    errors: result.errors,
    warnings: result.warnings
  };
};
