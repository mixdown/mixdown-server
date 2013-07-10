var util = require('util'),
    events = require('events'),
    _ = require('lodash'),
    broadway = require('broadway');

/**
* Returns a list of parents sorted by oldest generation to newest.
* @param siteConfig {SiteConfiguration} The site config to use when creating the app.
**/
var App = function(siteConfig) {
    this.config = siteConfig;
    this.plugins = new broadway.App();
};

util.inherits(App, events.EventEmitter);

App.prototype.init = function(callback) {
    var plugins = this.plugins,
        app = this;

    _.each(this.config.plugins, function(p) {
        var Mod = null,
            modulePath = (p.module || '').split('#'),
            path = modulePath.length ? modulePath[0] : null,
            prop = modulePath.length > 1 ? modulePath[1] : null,
            err = [];

        var emitError = function() {
            var msg = _.map(err, function(e) { return e.message; }).join('\\n');
            app.emit('error', new Error('Could not load plugin: ' + p.module + ', ' + msg));
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
                    app.plugins.use(new Mod(), _.extend({ app: app }, p.options || {}));
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

    });

    // now run broadway's init so that the plugins can perform any custom setup.
    app.plugins.init(callback);
};


module.exports = App;



