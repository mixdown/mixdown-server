var Router = require('pipeline-router');

var TestRouter = function() {};

/**
* Attaches an autos router plugin to an application.
*
**/ 
TestRouter.prototype.attach = function (options) {
	var app = options.app;

	/**
	* Initializes the routes for this application
	*
	**/
	this.router = function() {
	    var router = new Router();

	    // Home page
	    router.get('/', function (req, res) {
	        app.plugins.api(function(err, data) {
	            app.plugins.render('tests/views/index', data, function(err, html) {

	            	if (err) {
	            		res.writeHead(500, app.plugins.headers({ 'Content-Type': 'text/plain' }));
	            		res.end(err + err.stack);
	            	}
	            	else {
		            	res.writeHead(200, app.plugins.headers({ 'Content-Type': 'text/html' }));
						res.end(html);
					}
	            });
	        });
	    });

		// Home page
	    router.get('/api2', function (req, res) {
	        app.plugins.api2(function(err, data) {
	            app.plugins.render('tests/views/index', data, function(err, html) {

	            	if (err) {
	            		res.writeHead(500, app.plugins.headers({ 'Content-Type': 'text/plain' }));
	            		res.end(err + err.stack);
	            	}
	            	else {
		            	res.writeHead(200, app.plugins.headers({ 'Content-Type': 'text/html' }));
						res.end(html);
					}
	            });
	        });
	    });

	    return router;
	};


};

module.exports = TestRouter;