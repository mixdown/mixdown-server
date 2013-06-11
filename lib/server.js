var	_ = require('lodash'),
	fs = require('fs'),
	http = require('http'),
	cluster	= require('cluster');

module.exports = function(serverConfig) {
	var vhosts = {};

	var getRouter = function(app) {
		var router = _.isFunction(app.plugins.router) ? app.plugins.router() : app.plugins.router.create();

		router.on('error', function(err, results) {
	        var res = results[0].res,
	            req = results[0].req;
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
		_.each(serverConfig.apps, function(app) {

			// logger.info(siteConfig.hostmap);
			// consider moving the logger stuff to event emitters

			_.each(app.config.hostmap, function(host) {
				
				vhosts[host] = app;
				app.plugins.init(function(err) {
					if (err) {
						logger.error(err);
					}
				}); // TODO: add error checking and async callback for init.

			});
			
		});
	};

	// create the server.
	this.start = function(callback) {
		reload.call(this);

		// Set port from server config.
		var listen = serverConfig.server.listen || {},
			lp = listen.type === 'unix' ? listen.path : listen.port;

		var create = function() {
			var socket = http.createServer(function (req, res) {
				var host = req.headers.host.replace(/:\d+/, ''),
					app  = vhosts[host];

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



