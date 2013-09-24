var Mixdown = require('mixdown');
var config = require( './server.json');
var packageJSON = require('./package.json');
var util = require('util');

var mixdown = new Mixdown(config);

mixdown.on('error', function(err) {
  console.info(err);
});

try {
  var env = require('./server-' + process.env.MIXDOWN_ENV + '.json');
  mixdown.env(env);
}
catch(e) {}

logger.info(packageJSON.name + ' version: ' + packageJSON.version);

mixdown.start(function(err) {
  if (err) {
    if (logger) {
      logger.error('Server did not start');
    }
    else {
      console.log('Server did not start');
    }

    process.exit();
  }
});