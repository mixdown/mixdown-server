var _ = require('lodash'),
	winston = require('winston');

module.exports.create = function(options) {
	var logger = null;

	if (options) {

		// create array of transports from config.
		var transports = _.map(options.transports, function(transport) {

			var opt = _.defaults(transport.options, options.defaults);

	    	return new (winston.transports[transport.transport])({
		      	handleExceptions: opt.handleExceptions,
		      	json: opt.json,
		      	timestamp: opt.timestamp,
		      	colorize: opt.colorize
		    });
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