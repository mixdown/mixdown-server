var _ = require('lodash');
var util = require('util');
var cluster = require('cluster');
var mixdownMaster = require('./lib/master.js');
var mixdownWorker = require('./lib/worker.js');
var path = require('path');
var packageJSON = require(path.join(process.cwd(), '/package.json'));

// Export the factory
module.exports.create = function(mixdown, options) {
  var main = new Main(mixdown, options);
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

var logServerInfo = function(server,message) {

  var hmap = _.map(server.mixdown.apps, function(app){ 
    return _.pick(app, 'vhosts', 'id'); 
  });

  logger.info(message || 'Server Information. ', server.server.address(), hmap);
};

Main.prototype.createMaster = function() {
  var self = this;

  // start server.  Sets up server, port, and starts the app.
  self.master = new mixdownMaster(self.workers, self.options, self.mixdown);

  self.master.start(function(err, data) {
    if (err) {
      logger.error("Could not start server.  Stopping process.", err);
      process.exit();
    }
    else {
      self.socket = data.socket;
      self.server = data.server;
      logServerInfo(self, 'Server started successfully.');
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
  mixdown.on('reload', function() {
    logServerInfo(self, 'Mixdown reloaded. ');
  });

  // Start cluster.
  var clusterConfig = mixdown.main.options.cluster || {};

  if(clusterConfig.on){
    var numChidrenToSpawn = clusterConfig.workers || require('os').cpus().length;

    if(cluster.isMaster){
      logger.info("Using cluster");
      //cluser is on, and this is the master!
      logger.info("Starting master with " + numChidrenToSpawn + " workers");

      // spawn n workers
      for (var i = 0; i < numChidrenToSpawn; i++) {
        (function(){
          var child = cluster.fork();
          
          child.once('message',function(message){
            if(message == 'ready'){
            
              self.workers[child.process.pid] = child;
              logger.debug('initial child ready');
            }
          });

        })();
      }

      // Add application kill signals.
      var signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
      _.each(signals, function(sig) {

        process.on(sig, function() {

          _.each(cluster.workers, function(child) {
            child.destroy();  // send suicide signal
          });

          // create function to check self all workers are dead.
          var checkExit = function() {
            if (_.keys(cluster.workers).length == 0) {
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

      cluster.on('disconnect',function(worker) {
        delete self.workers[worker.process.pid];
        logger.info('worker '+worker.process.pid+' disconnected');
      });

      cluster.on('exit', function(worker) {

        // remove the child from the tracked running list..
        delete self.workers[worker.process.pid];

        // if it purposely destroyed itself, then do no re-spawn.
        if(!worker.suicide){
          logger.error('Worker exited unexpectedly. Spawning new worker');  
          // spawn new child
          var child = cluster.fork();

          child.on('message',function(message){
          if(message == 'ready'){
            logger.debug('respawned child ready id: ' + child.process.pid);
            self.workers[child.process.pid] = child;
          }
        });
        }
      });

      self.createMaster();

    } 
    else {
      //cluser is on, and this is a worker!
      logger.info("new worker Worker id: "+process.pid);

      try {
        self.worker = new mixdownWorker(mixdown);
      }
      catch(e) {
        typeof(callback) === 'function' ? callback(e, self) : null;
      }
    }
  }
  else {
    //cluster isn't running so create a master server.
    self.createMaster();
  }
};

