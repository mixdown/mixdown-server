var _ = require('lodash');
var http = require('http');
var util = require('util');
var events = require('events');

var Worker = function (mixdown) {
  this.vhosts = {};
  this.mixdown = mixdown;

  this.on('request', this.handleRequest);

  // send message support.  we listen for a socket.
  process.on('message', this.handleMessage.bind(this));

  // check if the external Config is enabled and starting listening if so.
  var self = this;

  //this is a bit of a problem, it is an async function in the constructor
  //also i don't think it's necessary as mixdown will do this?
  mixdown.getExternalConfig(function (err, externalConfig) {
    if (err) {
      logger.error(err);
    } else if (externalConfig) {

      logger.info('External Config initialized: ' + util.inspect(externalConfig));

      // ensure this gets called at least once.
      self.reload();

      externalConfig.on('update', function (services) {
        var servs;
        var overlays;

        if (services && services.length) {
          overlays = _.filter(services, function (s) {
            return s.overlay === true;
          });
          servs = _.reject(services, function (s) {
            return s.overlay === true;
          });
        } else {
          logger.error('no services were returned after the configuration change');
          return;
        }

        mixdown.overlays = overlays;
        mixdown.services = servs;

        mixdown.initServices(function (err) {
          if (err) {
            logger.error('Site refresh failed: ', err);
          } else {
            self.reload();
            mixdown.emit('reload', mixdown);
          }
        });
      });
    }
  });

  //need to do this incase process.send is not defined
  //which will be the case when cluster is off
  if (process.send) {
    process.send('ready');
  }

};

util.inherits(Worker, events.EventEmitter);

Worker.prototype.getRouter = function (app) {
  var router = _.isFunction(app.router) ? app.router() : app.router.create();

  if (router.listenerCount('error') === 0) {
    router.on('error', function (err, httpContext) {
      var res = httpContext.response;
      res.statusCode = 500;
      res.end(err ? err.stack : null);
    });
  }

  if (router.listenerCount('not_found') === 0) {
    router.on('not_found', function (err, httpContext) {
      var res = httpContext.response;
      res.statusCode = 404;
      res.end(err ? err.stack : null);
    });
  }
  return router;
};

Worker.prototype.reload = function () {

  // Reset vhosts
  var vhosts = {};

  // Loop over cobrands and add all of the apps by hostnames.
  _.each(this.mixdown.apps, function (app) {

    app.setup(function (err) {
      if (err) {
        logger.error(err);
      }
    }); // TODO: add error emitter.

    // map the vhost
    _.each(app._config.vhosts, function (host) {
      vhosts[host] = app;
    });

  });

  this.vhosts = vhosts;
};

Worker.prototype.handleRequest = function (req, res) {
  var app = null;
  var host = null;

  // for simple case, listen on all hosts.
  var appkeys = Object.keys(this.mixdown.apps);

  if (appkeys.length === 1) {
    app = this.mixdown.apps[appkeys[0]];
  } else {
    host = req.headers.host; //it is perfectly fine to include port # here (if it's in the req.headers.host and will break on port specified vhosts.
    app = this.vhosts[host];
  }

  // send to router.
  if (app) {
    this.getRouter(app).dispatch(req, res);
  } else {
    res.statusCode = 404;
    res.end("Could not find application.  Host: " + host);
  }
};

Worker.prototype.handleMessage = function (message, socket) {
  if (message === 'socket') {
    // call the http connection parsing stuff here.
    http._connectionListener.call(this, socket);
  }
};

module.exports = Worker;