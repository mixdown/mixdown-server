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
	},
	{
		"transport": "Syslog",
		"options": {
			"handleExceptions": true,
			"facility": "local1",
            "level": "info",
            "host": "localhost",
            "port": 514
		}
	}]
});

test("Test Console logger", function(t) {

	t.ok(logger, "logger should have been created.");
	t.equal(_.keys(logger.transports).length, 2, "logger should have 2 transports");

	logger.info('If you see this then the test passed.');

	t.end();
});



