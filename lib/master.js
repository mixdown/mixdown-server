var _ = require('lodash');
var fs = require('fs');
var net = require('net');
var util = require('util');
var assert = require('assert');
var Worker = require('./worker.js');

var Master = function(workers, options,mixdown) {

  this.options = options || {};
  this.currentIndex = 0;
  this.server = null;
  this.socket = null;
  this.workers = workers;

  if(!options.cluster.on){
    this.mixdown = mixdown;
  }
};

util.inherits(Master, Worker);

Master.prototype.getWorker = function() {
  var pids = Object.keys(this.workers);

  if (this.currentIndex >= pids.length) {
    this.currentIndex = 0;
  }

  return this.workers[pids[this.currentIndex++]];
};

Master.prototype.distribute = function(socket) {
  var worker = this.getWorker()
  var self = this;
  
  if(!worker){
    //TODO::make a correct http error
    socket.end('HTTP 1.1 500 Internal Server Error\nContent-Length:0'); 
  }
  else{
    self.handoff(worker, socket); 
  }
};

Master.prototype.handoff = function(worker, socket) {
  var self = this;
  worker.send('socket', socket);
};

// create the server.
Master.prototype.start = function(callback) {
  
  var self = this;
  var clusterEnabled = self.options.cluster.on;

  // Set port from server config.
  var listen = this.options.listen || {};

  if (listen.type !== 'unix' && !isNaN(process.env.MIXDOWN_PORT)) {
    listen.port = process.env.MIXDOWN_PORT;
  }

  var lp = listen.type === 'unix' ? listen.path : listen.port;

  var create = function() {
  
    logger.info('Starting master server');

    self.server = net.createServer(function() { return; });

    self.server.listen(lp, function(err) {
      callback(err, _.pick(self, 'server', 'socket'));
    });

    // remove the defaults so we don't parse things 2x
    self.server.removeAllListeners('connection');

    // add our connection handler:
    // if cluster is used, then the socket is distributed to a worker.
    // if cluster is not used, then handle in master.
    self.server.on('connection', function(socket) {
      if (clusterEnabled) {
        socket.pause();
        self.distribute(socket);
      }
      else {
        self.handleMessage('socket', socket);
      }
    });
  };

  // remove old file descriptor if needed.
  if (listen.type === 'unix') {
    fs.unlink(lp, create);
  }
  else {
    create();
    self.on('request',self.handleRequest);
  }
};

module.exports = Master;
