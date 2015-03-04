var errors = {
  E001: "Can't find open tag",
  E002: "Can't find close tag"
};

var matchSmarty = module.exports = function(code){
  var stack = [], qleft = [], qright = [], pairs = [], errors = [];
  for (var i=0, len=code.length; i<len; ++i){
    var ch = code.charAt(i);
    qleft.push(ch);
    qright.push(ch);
    if (qleft.length > matchSmarty.leftDelimiter.length) qleft.shift();
    if (qright.length > matchSmarty.rightDelimiter.length) qright.shift();

    if (qleft.length === matchSmarty.leftDelimiter.length &&
        qleft.join('') === matchSmarty.leftDelimiter){
      var startIndex = i - qleft.length + 1; // 左定界符起始位置
      stack.push({
        depth: stack.length,
        startIndex: startIndex
      });
    }
    if (qright.length === matchSmarty.rightDelimiter.length &&
        qright.join('') === matchSmarty.rightDelimiter){
      var endIndex = i; // 右定界符结束位置
      if (stack.length > 0){
        var tag = stack.pop();
        tag.endIndex = i;
        pairs.push(tag);
      }else{
        errors.push({
          errno: 'E001',
          message: errors['E001'],
          index: i
        });
      }
    }
  }
  while (stack.length > 0){
    var tag = stack.pop();
    errors.push({
      errno: 'E002',
      message: errors['E002'],
      index: tag.startIndex
    });
  }

  return {
    pairs: pairs,
    errors: errors
  };
};

matchSmarty.leftDelimiter = '{%';
matchSmarty.rightDelimiter = '%}';

matchSmarty.preprocess = function(code){

};