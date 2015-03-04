var Path = require('path'),
    glob = require('glob'),
    minimatch = require('minimatch'),
    fs = require('fs'),
    jslinsl = require('./lib/jslinsl'),
    csslinsl = require('./lib/csslinsl'),
    tpllinsl = require('./lib/tpllinsl'),
    utils = require('./lib/utils'),
    cache = require('./lib/cache'),
    Reporter = require('./lib/reporter'),
    collector = require('./lib/collector'),
    chalk = require('chalk'),
    argv = require('minimist')(process.argv);

var defaultMatchFn = function(){ return false; };
// function makeMatchMinimatch(rule){
//   return function(file){
//     return minimatch(file, rule);
//   };
// }
// function makeMatchRegex(rule){
//   return function(file){
//     return rule.test(file);
//   };
// }
function matchRule(file, rule){
  if (utils.is(rule, 'String')){
    if (minimatch(file, rule)){
      return true;
    }
  }
  if (utils.is(rule, 'RegExp')){
    if (rule.test(file)){
      return true;
    }
  }
  if (utils.is(rule, 'Function')){
    if (rule(file)){
      return true;
    }
  }
  return false;
}
var ext2linter = {
  '.html':   'tpl',
  '.tpl':    'tpl',
  '.js':     'js',
  '.coffee': 'js',
  '.css':    'css',
  '.less':   'css'
};
module.exports = exports = function(conf, callback){
  collector.reset();
  if (conf.color === false){
    chalk.enabled = false;
  }
  if (conf.logo !== false){
    utils.logo();
  }

  cache.enabled = true;
  if (utils.is(conf.useCache, 'Boolean')){
    cache.enabled = conf.useCache;
  }
  cache.init();
  if (!cache.cached(module.parent.filename, true)){
    cache.enabled = false;
  }

  var startTime = utils.hrtime();
  utils.verbose = conf.verbose || false;

  var ignores = conf.ignores || [],
      settings = conf.settings || [];
  // 先把ignore规则都构造成function
  var ignore = function(file){
    for (var i=0, len=ignores.length; i<len; ++i){
      var rule = ignores[i];
      if (matchRule(file, rule)){
        return true;
      }
    }
    return false;
  };
  // 把settings的每一个项的路径指定都做成一个匹配函数match
  settings.forEach(function(set){
    var rules = set.path;
    if (!utils.is(rules, 'Array')){
      rules = [rules];
    }
    var fn = function(file){
      for (var i=0; i<rules.length; ++i){
        var rule = rules[i];
        if (matchRule(file, rule)){
          return true;
        }
      }
      return false;
    };
    set.match = fn;
  });

  var reportLine = Reporter.prototype.reportLine;
  if (utils.is(conf.report, 'String')){
    // 定义了输出文件，那就不要输出到命令行了，重写reportLine方法
    var reportFile = Path.join(process.cwd(), conf.report);
    chalk.enabled = false; // 输出到文件时关闭颜色
    fs.writeFileSync(reportFile, '', { flag:'w+' });
    reportLine = function(line){
      fs.appendFileSync(reportFile, line + '\n');
    };

    console.log('[NOTICE] You may see lint report in ' + conf.report + '.');
  }

  var summary = {
    timeUsed: 0,
    result: []
  };

  function gatherReports(reporter){
    summary.result.push({
      file: reporter.file,
      errors: reporter.errors,
      warnings: reporter.warnings
    });
  }
  function cacheReports(path, reporter){
    cache.set(path, {
      errors: reporter.errors,
      warnings: reporter.warnings
    });
  }

  var cwd = Path.join(process.cwd(), (conf.cwd || './'));

  var lintFile = function(files, n, finish){
    if (n >= files.length){
      return finish();
    }

    var file = files[n];
    var relative = Path.relative(cwd, file);

    var stat = fs.statSync(file);
    if (!stat.isFile()){
      return lintFile(files, n + 1, finish);
    }
    collector.inc('files', 'count');
    var ext = Path.extname(relative);
    collector.inc('extStats', ext);
    if (ignore(relative)){
      utils.debug('ignored', relative);
      collector.inc('files', 'ignore');
      return lintFile(files, n + 1, finish);
    }
    var reporter = new Reporter(relative, conf.reportWarning);
    reporter.reportLine = reportLine;
    var cacheObj = cache.get(file, true);
    if (cacheObj){
      utils.debug('cached', relative);
      collector.inc('files', 'cached');
      reporter.errors = cacheObj.errors;
      reporter.warnings = cacheObj.warnings;
      reporter.report();
      gatherReports(reporter);
      return lintFile(files, n + 1, finish);
    }
    utils.debug('lint', relative);

    var setting = {
      encoding: 'utf-8',
      lintAs: ext,
      jshint: jslinsl.mergeSetting(),
      csslint: csslinsl.mergeSetting(),
      allowSmartyInJS: false,
      allowSmartyInCSS: false
    };
    settings.forEach(function(set){
      // 后面的配置项覆盖前面的
      if (set.match(relative)){
        ['encoding', 'lintAs'].forEach(function(key){
          if (utils.is(set[key], 'String')){
            setting[key] = set[key];
          }
        });
        ['allowSmartyInCSS', 'allowSmartyInJS'].forEach(function(key){
          if (utils.is(set[key], 'Boolean')){
            setting[key] = set[key];
          }
        });
        setting.jshint = jslinsl.mergeSetting(setting.jshint, set.jshint);
        setting.csslint = csslinsl.mergeSetting(setting.csslint, set.csslint);
      }
    });
    if (setting.lintAs[0] !== '.') setting.lintAs = '.' + setting.lintAs;
    setting.lintAs = ext2linter[setting.lintAs] || 'tpl';
    var lintAs = setting.lintAs;
    collector.inc('typeStats', lintAs);

    setting.subpath = relative;

    fs.readFile(file, { encoding: setting.encoding }, function(err, content){
      if (err){
        reporter.error({
          message: 'Error opening file.',
        });
        reporter.report();
        gatherReports(reporter);
        cacheReports(file, reporter);
        lintFile(files, n + 1, finish);
      }else{
        switch(lintAs){
          case 'tpl':
            tpllinsl(content, setting, reporter, function(){
              reporter.report();
              gatherReports(reporter);
              cacheReports(file, reporter);
              lintFile(files, n + 1, finish);
            });
            break;
          case 'js':
            jslinsl(content, setting, reporter, 0, 0);
            reporter.report();
            gatherReports(reporter);
            cacheReports(file, reporter);
            lintFile(files, n + 1, finish);
            break;
          case 'css':
            csslinsl(content, setting, reporter, 0, 0);
            reporter.report();
            gatherReports(reporter);
            cacheReports(file, reporter);
            lintFile(files, n + 1, finish);
            break;
        }
      }
    });
  };
  var pathes = conf.path || './**/*';
  if (!utils.is(pathes, 'Array')){
      pathes = [pathes];
  }
  var lintFiles = function(num){
    if (num == pathes.length){
      var endTime = utils.hrtime();
      var timeUsed = endTime - startTime;
      summary.timeUsed = endTime - startTime;
      summary.extStats = collector.getGroup('extStats');
      summary.typeStats = collector.getGroup('typeStats');
      summary.fileCount = collector.getGroup('files').count;
      summary.ignoreCount = collector.getGroup('files').ignore;
      summary.cachedCount = collector.getGroup('files').cached;

      cache.write();
      return callback(summary);
    }
    var match = pathes[num];

    glob(match, { root: cwd }, function(err, files){
      lintFile(files, 0, function(){
        lintFiles(num + 1);
      });
    });
  };
  lintFiles(0);
};

exports.mapExt = function(ext, type){
  if (ext[0] !== '.') ext = '.' + ext;
  ext2linter[ext] = type;
};

/* vim: set ts=2 sw=2: */
