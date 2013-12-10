var _ = require('lodash');
var fs = require('fs');
var net = require('net');
var util = require('util');
var assert = require('assert');
var Worker = require('./worker.js');

var Master = function(mixdown, options) {
  this.mixdown = mixdown;
  this.options = options || {};
  this.currentIndex = 0;
  this.server = null;
  this.socket = null;
};

util.inherits(Master, Worker);

Master.prototype.getWorker = function() {
  var pids = Object.keys(this.mixdown.main.workers);

  if (this.currentIndex >= pids.length) {
    this.currentIndex = 0;
  }

logger.debug(pids);
logger.debug(this.currentIndex);

  return this.mixdown.main.workers[pids[this.currentIndex++]];
};

Master.prototype.distribute = function(socket) {
  this.handoff(this.getWorker(), socket);
};

Master.prototype.handoff = function(worker, socket) {
  worker.send('socket', socket);
};

  // create the server.
Master.prototype.start = function(callback) {
  var self = this;
  var clusterEnabled = this.mixdown.main.options.cluster.on;

  // Set port from server config.
  var listen = this.options.listen || {};

  if (listen.type !== 'unix' && !isNaN(process.env.MIXDOWN_PORT)) {
    listen.port = process.env.MIXDOWN_PORT;
  }
  var lp = listen.type === 'unix' ? listen.path : listen.port;

  var create = function() {
    logger.info('Starting master server');

    self.server = net.createServer(function() { return; });
    self.socket = self.server.listen(lp, function(err) {
      callback(err, _.pick(self, 'server', 'socket'));
    });

    // remove the defaults so we don't parse things 2x
    self.server.removeAllListeners('connection');

    // add our connection handler:
    // if cluster is used, then the socket is distributed to a worker.
    // if cluster is not used, then handle in master.
    self.server.on('connection', function(socket) {
      if (clusterEnabled) {
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
  }
};


module.exports = Master;
