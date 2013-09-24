var _ = require('lodash'),
  opt = require('optimist'),
  util = require('util'),
  cluster = require('cluster'),
  mixdownServer = require('./lib/server.js');

// Export the factory
exports.create = function(options) {
  var main = new Main(options);

  var argv = opt
    .alias('h', 'help')
    .alias('?', 'help')
    .describe('help', 'Display help')
    .usage('Starts ' + main.packageJSON.name + ' framework for serving multiple sites.\n\nVersion: ' + main.packageJSON.version + '\nAuthor: ' + main.packageJSON.author)
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

var Main = function(options) {
  this.server = null;
  this.packageJSON = options.packageJSON || {};
  this.mixdownConfig = options.mixdownConfig;
  this.workers = {};
  this.socket = null;
};

Main.prototype.start = function(callback) {
  var that = this;
  var mixdownConfig = this.mixdownConfig;

  // this reload listener just logs the reload info.
  mixdownConfig.on('reload', function(serverCfg) {
    var hmap = [];
    _.each(mixdownConfig.apps, function(app) { 
      hmap.push({ 
        hostmap: app.config.hostmap,
        id: app.config.id
      });
    });
    logger.info("Server configuration successfully reloaded " + util.inspect(that.socket.address()) + ". " + util.inspect(hmap) );
  });

  var createServer = function(done) {
    // start server.  Sets up server, port, and starts the app.
    that.server = new mdServer(mixdownConfig);

    that.server.start(function(err, data) {
      if (err) {
        logger.critical("Could not start server.  Stopping process.", err);
        process.exit();
      }
      else {
        that.socket = data.socket;

        var hmap = [];
        _.each(mixdownConfig.apps, function(app) { 
          hmap.push({ 
            hostmap: app.config.hostmap,
            id: app.config.id
          });
        });
        logger.info("Server started successfully listening on " + util.inspect(that.socket.address()) + ". " + util.inspect(hmap) );

        done(err, that);
      }
    });
  };

  // Start cluster.
  var children = this.workers;
  var clusterConfig = mixdownConfig.main.cluster || {};

  if(clusterConfig.on){
    logger.info("Using cluster");
    
    var numCPUs = clusterConfig.workers || require('os').cpus().length;
    
    if(cluster.isMaster){
      logger.info("Starting master with " + numCPUs + " CPUs");

      // spawn n workers
      for (var i = 0; i < numCPUs; i++) {
        var child = cluster.fork();
        children[child.process.pid] = child;
      }

      // Add application kill signals.
      var signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
      _.each(signals, function(sig) {

        process.on(sig, function() {

          _.each(children, function(child) {
            child.destroy();  // send suicide signal
          });

          // create function to check that all workers are dead.
          var checkExit = function() {
            if (_.keys(children).length == 0) {
              process.exit();
            }
            else {
              process.nextTick(checkExit);   // keep polling for safe shutdown.
            }
          };

          // poll the master and exit when children are all gone.
          process.nextTick(checkExit);
          
        });

      });

      cluster.on('exit', function(worker) {
        logger.error('Worker exited unexpectedly. Spawning new worker', worker);

        // remove the child from the tracked running list..
        delete children[worker.process.pid];

        // if it purposely destroyed itself, then do no re-spawn.  
        // Otherwise, it was killed for some external reason and should create a new child in the pool.
        if (!worker.suicide) {

          // spawn new child
          var child = cluster.fork();
          children[child.process.pid] = child;
        }
         
      });

    } else {
      logger.info("Worker ID", process.env.NODE_WORKER_ID);
      createServer(callback);
    }
    
  } 
  else {
    createServer(callback);
  }
};

