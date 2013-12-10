var _ = require('lodash');
var fs = require('fs');
var net = require('net');
var util = require('util');
var events = require('events');
var assert = require('assert');
var Worker = require('./worker.js');

var Master = function(mixdown, options) {
  var self = this;

  this.currentIndex = 0;

  if (!mixdown.main.options.cluster.on) {
    Worker.call(this, mixdown);
  }

  this.getWorker = function() {
    var pids = Object.keys(mixdown.main.workers);

    if (this.currentIndex >= pids.length) {
      this.currentIndex = 0;
    }

logger.debug(pids);
logger.debug(this.currentIndex);

    return mixdown.main.workers[pids[this.currentIndex++]];
  };

  this.distribute = function(socket) {
    this.handoff(this.getWorker(), socket);
  };

  this.handoff = function(worker, socket) {
    worker.send('socket', socket);
  };

  // create the server.
  this.start = function(callback) {

    // Set port from server config.
    var listen = options.listen || {};

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
        if (mixdown.main.options.cluster && mixdown.main.options.cluster.on) {
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
};

util.inherits(Master, events.EventEmitter);

module.exports = Master;
