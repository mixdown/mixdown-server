var _ = require('lodash');

var Headers = function() {};

Headers.prototype.attach = function(options) {
	this.headers = function(headers) {
		return _.extend(headers, options.headers);
	};
};

module.exports = Headers;