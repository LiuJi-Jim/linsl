/**
 * 收集各种全局的统计数据
 */

var collector = module.exports = {
};
collector.init = function(){
  collector.data = {};
};
collector.reset = collector.init;

collector.getGroup = function(key){
  if (!(key in collector.data)){
    collector.data[key] = {};
  }
  return collector.data[key];
};
collector.inc = function(group, key){
  var map = collector.getGroup(group);
  if (key in map){
    map[key]++;
  }else{
    map[key] = 1;
  }
  return map[key];
};

collector.push = function(group, key, value, uniq){
  var map = collector.getGroup(group),
      array = [];
  if (key in map){
    array = map[key];
  }else{
    map[key] = array;
  }
  if (uniq){
    var found = false;
    for (var i=0, len=array.length; i<len; ++i){
      if (array[i] == value){
        found = true;
        break;
      }
    }
    if (!found){
      array.push(value);
    }
  }else{
    array.push(value);
  }
};

collector.pushUniq = function(group, key, value){
  return collector.push(group, key, value, true);
};