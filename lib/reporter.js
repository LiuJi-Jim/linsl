var utils = require('./utils');
var chalk = require('chalk');

function compareLineCol(a, b){
  var line = a.line - b.line;
  if (line !== 0) return line;
  return a.col - b.col;
}

var Reporter = module.exports = function(file, reportWarning){
  this.errors = [];
  this.warnings = [];
  this.file = file;
  this.reportWarning = utils.is(reportWarning, 'Boolean') ? reportWarning : true;
};
utils.extend(Reporter.prototype, {
  warn: function(warning){
    this.warnings.push(warning);
  },
  error: function(error){
    this.errors.push(error);
  },
  /**
   * overwrite这个方法可以实现自定义的输出格式
   */
  formatLine: function(type, obj){
    var str = utils.format('[%s][%s:%d:%d]', type, this.file, obj.line, obj.col);
    if (obj.module){
      str += utils.format('[%s]', obj.module);
    }
    str += ' ' + obj.message;
    if (obj.code){
      str += utils.format(' (rule:%s)', obj.code);
    }
    return str;
  },
  /**
   * overwrite这个方法可以实现自定义的输出目标
   */
  reportLine: function(line){
    //process.stdout.write('\n' + str + '\n');
    console.log(line);
  },
  report: function(){
    var i, lines = [];
    for (i=0; i<this.errors.length; ++i){
      var err = this.errors[i];
      lines.push({
        str: this.formatLine(chalk.red('Error'), err),
        line: err.line,
        col: err.col
      });
    }
    if (this.reportWarning){
      for (i=0; i<this.warnings.length; ++i){
        var warn = this.warnings[i];
        lines.push({
          str: this.formatLine(chalk.yellow('Warning'), warn),
          line: warn.line,
          col: warn.col
        });
      }
    }
    lines.sort(compareLineCol);
    for (i=0; i<lines.length; ++i){
      this.reportLine(lines[i].str);
    }
  }
});