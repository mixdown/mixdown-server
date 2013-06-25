var _ = require('lodash');

var pluginUtility = {


  require: function(options) {

    if (!options || !options.plugin) {
      throw new Error('No plugin was passed into require. Cannot require module.');
    }

    var Mod = null,
        p = options.plugin, 
        modulePath = (p.module || '').split('#'),
        path = modulePath.length ? modulePath[0] : null,
        prop = modulePath.length > 1 ? modulePath[1] : null,
        err = [];

    var emitError = function() {
        var msg = _.map(err, function(e) { return e.message; }).join('\\n');
        throw new Error('Could not load plugin: ' + p.module + ', ' + msg);
    };

    if (path) {
      try {
        Mod = require(path);
      } catch (e) {
        err.push(e);
      }

      if (!Mod) {
        try {
          Mod = require(process.cwd() + path);
        } catch (e) {
          err.push(e);
        }
      }

      if (Mod) {
        try {
          Mod = prop ? Mod[prop] : Mod;
        }
        catch (e) {
          err.push(e);
          emitError();
        }
      }
      else {
        emitError();
      }
    }

    return Mod;
  },

  use: function(options) {

    if (!options || !options.plugin) {
      throw new Error('No plguin was passed into resolve. Cannot require module.');
    }

    if (!options || !options.app) {
      throw new Error('No app was passed into resolve. Cannot attach plugin');
    }

    var Mod = pluginUtility.require(options);
    var app = options.app;
    app.use(new Mod(), _.extend({ app: app }, options.plugin.options || {}));
  }
};

module.exports = pluginUtility;   