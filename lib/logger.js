var _ = require('lodash'),
	winston = require('winston'),
	syslog = require('winston-syslog');

module.exports.create = function(options) {
	var logger = null;

	if (options) {

		// create array of transports from config.
		var transports = _.map(options.transports, function(transport) {
	    	return new  (winston.transports[transport.transport])(
	    					_.defaults(transport.options, options.defaults)
	    				);
	    });

		// create logger instance
		logger = new (winston.Logger)({
		    exitOnError: false, 
		    transports: transports
		});

		// set levels
		logger.setLevels(winston.config.syslog.levels);
	}

	return logger;
};