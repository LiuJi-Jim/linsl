var utils = require('./utils');
var fs = require('fs');
var Path = require('path');
var mkdirp = require('mkdirp');

exports.enabled = true;

var temp_root;
function mkdir(path, mode){
  return mkdirp.sync(path, mode);
}
function getTempPath(){
  if (!temp_root){
    var list = ['LINSL_TMP_DIR', 'LOCALAPPDATA', 'APPDATA', 'HOME', 'TEMP'];
    var tmp;
    for (var i=0; i<list.length; ++i){
      if (list[i] in process.env){
        tmp = process.env[list[i]];
        break;
      }
    }
    if (!tmp){
      tmp = Path.join(__dirname + '../');
    }
    tmp = Path.join(tmp, '.linsl-cache');
    temp_root = tmp;
  }
  return temp_root;
}
function getTempFile(){
  return Path.join(getTempPath(), utils.md5(process.cwd()) + '.json');
}
var dict;
function initDict(){
  var cacheDir = getTempPath();
  if (!fs.existsSync(cacheDir)){
    try{
      mkdir(cacheDir);
    }catch(ex){
    }
  }
  var dictFile = getTempFile();
  if (fs.existsSync(dictFile)){
    try{
      dictStr = fs.readFileSync(dictFile);
      dict = JSON.parse(dictStr);
    }catch(ex){
    }
  }
  if (!dict || !dict.files || !dict.cwd){
    dict = {
      cwd: process.cwd(),
      files: {}
    };
  }
}

exports.init = function(){
  //if (!exports.enabled) return;
  initDict();
};
exports.cached = function(path, touch){
  if (!exports.enabled && !touch) return false;
  var cache = dict.files[path] || {};
  var cacheMtime = cache.mtime || 0,
      fileMtime = fs.statSync(path).mtime.getTime();
  if (cacheMtime == fileMtime){
    return true;
  }
  if (touch){
    cache.mtime = fileMtime;
    dict.files[path] = cache;
  }
  return false;
};
exports.get = function(path, touch){
  if (!exports.cached(path, touch)){
    return null;
  }
  var cache = dict.files[path];
  return (cache.data || null);
};
exports.set = function(path, data){
  var ret = null;
  if (exports.cached(path, true)){
    ret = data;
  }
  var cache = dict.files[path];
  cache.data = data;
  return ret;
};
exports.write = function(){
  //if (!exports.enabled) return;
  var dictFile = getTempFile();
  fs.writeFileSync(dictFile, JSON.stringify(dict, null, '  '), 'utf-8');
};

/* vim: set tw=2 ts=2 sw=2: */
