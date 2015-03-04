var extend = require('extend');
var util = require('util');
var array_slice = Array.prototype.slice;
var crypto = require('crypto');

exports.extend = extend;

exports.format = function(){
  return util.format.apply(util, arguments);
};

var is = exports.is = function(source, type){
  return toString.call(source) === '[object ' + type + ']';
};

var objClone = exports.objClone = function(obj){
  return extend({}, obj);
};

var arrClone = exports.arrClone = function(arr){
  return array_slice.call(arr, 0);
};

exports.verbose = false;
exports.debug = function debug(){
  if (!exports.verbose) return;
  var args = arrClone(arguments);
  console.log.apply(console, ['[DEBUG]'].concat(args));
};
exports.warn = function warn(){
  if (!exports.verbose) return;
  var args = arrClone(arguments);
  console.log.apply(console, ['[WARNING]'].concat(args));
};

exports.reLineBreaker = /\r\n|\n\r|\n|\r/g;

exports.hrtime = (function(){
  if (typeof process.hrtime !== 'undefined'){
    return function(){
      var diff = process.hrtime();
      return (diff[0] * 1e9 + diff[1]) / 1e6; // nano second -> ms
    };
  }else{
    return function(){
      return (new Date()).getTime();
    };
  }
})();

exports.md5 = function(data, cutLength){
  var md5sum = crypto.createHash('md5'),
      encoding = typeof data === 'string' ? 'utf8' : 'binary';
  md5sum.update(data, encoding);
  var result = md5sum.digest('hex');
  if (is(cutLength, 'Number')){
    result = result.substring(0, cutLength);
  }
  return result;
};

var OffsetCounter = exports.OffsetCounter = function(lineOffset, charOffset){
  this.lineOffset = lineOffset || 0;
  this.charOffset = charOffset || 0;
  this._line = 1;
  this._col = 1;
};
Object.defineProperties(OffsetCounter.prototype, {
  'lineCounter': {
    get: function(){ return this._line; },
    set: function(val){ this._line = val; },
    enumerable: true,
    configurable: true
  },
  'columnCounter': {
    get: function(){ return this._col; },
    set: function(val){ this._col = val; },
    enumerable: true,
    configurable: true
  },
  'line': {
    get: function(){ return this._line + this.lineOffset; },
    enumerable: true
  },
  'col': {
    get: function(){ return this._col + this.charOffset; }
  }
});

exports.logo = function(){
  console.log((new Array(40)).join('='));
  console.log('');
  console.log('linsl = Linsl Is Not a Simple Linter.');
  console.log('');
  console.log((new Array(40)).join('='));
};
