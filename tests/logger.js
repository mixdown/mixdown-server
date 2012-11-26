var _ = require('lodash'),
	mixdownLogger = require('../lib/logger'),
	tap = require('tap'),
	test = tap.test;

global.logger = mixdownLogger.create({
	"defaults": {
		"handleExceptions": false,
      	"json": true,
      	"timestamp": true,
      	"colorize": true
	},
	"transports": [{
		"transport": "Console",
		"options": {
			"handleExceptions": true
		}
	}]
});

test("Test Console logger", function(t) {

	t.ok(logger, "logger should have been created.");
	t.equal(_.keys(logger.transports).length, 1, "logger should have one transport");

	logger.info('If you see this then the test passed.');

	t.end();
});



