var _ = require('lodash'),
        winston = require('winston');

require('winston-syslog');

// Until this is fixed, attaching to global logger seems to be only option.
// https://github.com/indexzero/winston-syslog/issues/7
module.exports.create = function(options) {
        var logger = winston;

        if (options) {

            // create array of transports from config.
            var transports = _.map(options.transports, function(transport) {
            	var opt = _.defaults(transport.options, options.defaults);
				logger.add(winston.transports[transport.transport], opt);
            });


            // set levels
            logger.setLevels(winston.config.syslog.levels);
        }

        return logger;
};