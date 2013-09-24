var _ = require('lodash'),
  fs = require('fs'),
  http = require('http'),
  util = require('util'),
  cluster = require('cluster');

module.exports = function(mixdownConfig) {

  // TODO: validate mixdown config for web app



  var vhosts = {};

  var getRouter = function(app) {
    var router = _.isFunction(app.plugins.router) ? app.plugins.router() : app.plugins.router.create();

    router.on('error', function(err, results) {
      var httpContext = results[0].httpContext || {};

      var res = httpContext.response || results[0].res,
          req = httpContext.request ||results[0].req;
      err = err || {};

      res.statusCode = 500;
      res.end(err.stack);
    });

    return router;
  };

  var reload = this.reload = function() {

    // Reset vhosts
    vhosts = {};

    // Loop over cobrands and add all of the apps by hostnames.
    _.each(mixdownConfig.apps, function(app) {

      app.plugins.init(function(err) {
        if (err) {
          logger.error(err);
        }
      }); // TODO: add error emitter.

      // map the vhost
      _.each(app.config.vhosts, function(host) {
        vhosts[host] = app;
      });
      
    });
  };

  // check if the external Config is enabled and starting listening if so.
  var that = this;
  mixdownConfig.getExternalConfig(function(err, externalConfig) {

    if (err) {
      logger.error(err);
    }
    else if (externalConfig) {

      logger.info('External Config initialized: ' + util.inspect(externalConfig));

      externalConfig.on('sites', function(services) {

        mixdownConfig.services = services;

        serverConfig.initApps(function(err) {
          if (err) {
            logger.error('Site refresh failed: ', err);
          }
          else {
            that.reload();
            services.emit('reload', serverConfig);
          }
        });

      });

    }
  });

  // create the server.
  this.start = function(callback) {
    reload.call(this);

    // Set port from server config.
    var listen = services.server.listen || {};

    if (listen.type !== 'unix' && !isNaN(process.env.MIXDOWN_PORT)) {
      listen.port = process.env.MIXDOWN_PORT;
    }
    var lp = listen.type === 'unix' ? listen.path : listen.port;

    var create = function() {
      var socket = http.createServer(function (req, res) {
        var app = null;
        var host = null;

        // for simple case, listen on all hosts.
        if (Object.keys(mixdownConfig.apps).length === 1) {
          app = mixdown.apps.default;
        }
        else {
          host = req.headers.host.replace(/:\d+/, '');
          app  = vhosts[host];
        }

        // send to router.
        if (app) {
          getRouter(app).dispatch(req, res);
        }
        else {
          res.statusCode = 404;
          res.end("Could not find application.  Host: " + host);
        }

      }).listen(lp, function(err) {
        callback(err, { socket: socket });
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