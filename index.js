var _ = require('lodash');
var opt = require('optimist')
var util = require('util');
var cluster = require('cluster');
var mixdownMaster = require('./lib/master.js');
var mixdownWorker = require('./lib/worker.js');
var path = require('path');
var packageJSON = require(path.join(process.cwd(), '/package.json'));

// Export the factory
exports.create = function(mixdown, options) {
  var main = new Main(mixdown, options);

// placeholder for options for starting the server
  var argv = opt
    .alias('h', 'help')
    .alias('?', 'help')
    .describe('help', 'Display help')
    .usage('Starts ' + packageJSON.name + ' framework for serving multiple sites.\n\nVersion: ' + packageJSON.version + '\nAuthor: ' + packageJSON.author)
    .alias('v', 'version')
    .describe('version', 'Display Mixdown application version.')
    .argv;

  if(argv.help) {
    opt.showHelp();
    process.exit();
  }

  if(argv.version) {
    console.log(packageJSON.version);
    process.exit();
  }

  return main;
};

var Main = function(mixdown, options) {

  // instance attrs
  this.server = null;
  this.workers = {};   // if this is a master, then we'll load this with child processes.
  this.socket = null;

  this.master = null;  // if this is a master, then we'll set this delegate.
  this.worker = null;  // if this is a worker, then we'll set this delegate.

  // passed configs.
  this.mixdown = mixdown;
  this.options = _.defaults(options || {}, {
    cluster: {
      on: false
    }
  });
};

var logServerInfo = function(message) {
  var hmap = _.map(this.mixdown.apps, function(app) { return _.pick(app, 'vhosts', 'id'); });
  logger.info(message || 'Server Information. ', this.socket.address(), hmap);
};

Main.prototype.createMaster = function() {
  var self = this;

  // start server.  Sets up server, port, and starts the app.
  self.master = new mixdownMaster(self.mixdown, self.options);

  self.master.start(function(err, data) {
    if (err) {
      logger.error("Could not start server.  Stopping process.", err);
      process.exit();
    }
    else {
      self.socket = data.socket;
      self.server = data.server;
      logServerInfo.call(self, 'Server started successfully.');
      typeof(callback) === 'function' ? callback(err, self) : null;
    }
  });
};

Main.prototype.stop = function(callback) {
  throw new Error('stop() not implemented on server.  TODO.');
};

Main.prototype.start = function(callback) {
  var self = this;
  var mixdown = this.mixdown;


  // this reload listener just logs the reload info.
  mixdown.on('reload', logServerInfo.bind(this, 'Mixdown reloaded.  '));

  // Start cluster.
  var clusterConfig = mixdown.main.options.cluster || {};

  if(clusterConfig.on){
    logger.info("Using cluster");

    var numCPUs = clusterConfig.workers || require('os').cpus().length;

    if(cluster.isMaster){
      logger.info("Starting master with " + numCPUs + " CPUs");

      // spawn n workers
      for (var i = 0; i < numCPUs; i++) {
        var child = cluster.fork();
        self.workers[child.process.pid] = child;
      }

      // Add application kill signals.
      var signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
      _.each(signals, function(sig) {

        process.on(sig, function() {

          _.each(self.workers, function(child) {
            child.destroy();  // send suicide signal
          });

          // create function to check self all workers are dead.
          var checkExit = function() {
            if (_.keys(self.workers).length == 0) {
              process.exit();
            }
            else {
              setImmediate(checkExit);   // keep polling for safe shutdown.
            }
          };

          // poll the master and exit when children are all gone.
          setImmediate(checkExit);

        });

      });

      cluster.on('exit', function(worker) {
        logger.error('Worker exited unexpectedly. Spawning new worker', worker);

        // remove the child from the tracked running list..
        delete self.workers[worker.process.pid];

        // if it purposely destroyed itself, then do no re-spawn.
        // Otherwise, it was killed for some external reason and should create a new child in the pool.
        if (!worker.suicide) {

          // spawn new child
          var child = cluster.fork();
          self.workers[child.process.pid] = child;
        }

      });

      self.createMaster();

    } else {
      logger.info("Worker ID", process.pid);

      try {
        self.worker = new mixdownWorker(mixdown);
      }
      catch(e) {
        typeof(callback) === 'function' ? callback(e, self) : null;
      }
    }

  }
  else {
    self.createMaster();
  }
};

