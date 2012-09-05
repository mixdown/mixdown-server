var	_ = require('lodash'),
	http = require('http');

module.exports = function(serverConfig) {

	var getRouter = function(app) {
		var router = app.plugins.router();

		router.on('error', function(err, results) {
	        var res = results[0].res,
	            req = results[0].req;
	        err = err || {};

	        res.statusCode = 500;
	        res.end(err.stack);
	    });

	    return router;
	};

	// create the server.
	this.start = function(callback) {

		try {

			// Create the main server
			var vhosts = {};

			// Loop over cobrands and add all of the apps by hostnames so that express can do the mapping automatically.
			_.each(serverConfig.apps, function(app) {

				// logger.info(siteConfig.hostmap);
				// consider moving the logger stuff to event emitters

				_.each(app.config.hostmap, function(host) {
					vhosts[host] = app;
				});
				
			});

			// Set port from server config.
			var port = serverConfig.server.port || 8080;

			http.createServer(function (req, res) {
				var host = req.headers.host.replace(/:\d+/, ''),
					app  = vhosts[host];

				if (app) {
					getRouter(app).dispatch(req, res);
				}
				else {
					res.statusCode = 404;
					res.end("Could not find application.  Host: " + host);
				}

			}).listen(port);
		}
		catch (err) {
			callback(err);
			return;
		}

		callback();
	};
};



