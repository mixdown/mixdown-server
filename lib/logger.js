var _ = require('lodash'),
	winston = require('winston');

require('winston-syslog').Syslog;

module.exports.create = function(options) {
	var logger = null;

	if (options) {

		// create logger instance
		logger = new (winston.Logger)({
		    exitOnError: false
		});

		// set levels
		logger.setLevels(winston.config.syslog.levels);

		// create array of transports from config.
		_.each(options.transports, function(transport, i) {
			var opt = _.defaults(transport.options || {}, options.defaults || {}),
				newt = new (winston.transports[transport.transport])(opt);

			newt.name = 'mixdown-logger-' + i + '-' + transport.transport;
			logger.add(newt, null, true);
	    });

	}

	return logger;
};