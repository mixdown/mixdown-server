var mixdown = {};

mixdown.Server = require('./lib/server');
mixdown.App = require('./lib/app');
mixdown.Config = require('./lib/config');
mixdown.Logger = require('./lib/logger');
mixdown.MainFactory = require('./lib/main');
mixdown.CouchConfig = require('./lib/couchconfig.js');

module.exports = mixdown;