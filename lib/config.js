var util = require('util'),
    events = require('events'),
    fs = require('fs'),
	App = require('./app'),
	_ = require('lodash');

/**
 * 
 *	Config - loads and manages configuration for environment and sites.
 * 	@param config - Object containing the server configuration.
**/
var Config = function(config) {
	this.config = config;
};

util.inherits(Config, events.EventEmitter);

Config.prototype.init = function() {
	var that = this,
		raw = this.config;

	this.server = raw.server;
	this.apps = {};

	// enumerate and create the apps
	_.each(raw.sites, function(site) {
		_.bind(mergeSection, site, raw.app, 'plugins')();
		site.server = raw.server;
		var app = new App(site);

		app.on('error', function(err) {
			that.emit('error', err);
		});

		app.id = site.id;
		app.init();
		that.apps[site.id] = app;
	});

};


/**
* Applies the overrides from the env config.  Useful for setting a base config, then applying configuration overrides.
* @param env - String representing the env overrides for this config.  This will load the config 
**/
Config.prototype.env = function(env) {

	if (env) {

		// apply merge of plugins at app level
		_.bind(mergeSection, this.config.app, env.app, 'plugins', true)();

		_.each(this.config.sites, function(site) {
			var esite = _.find(env.sites, function(s) { return s.id == site.id; });

			if (esite) {
				// apply overrides of plugins
				_.bind(mergeSection, site, esite, 'plugins', true)();

				// apply overrides of hostmap
				site.hostmap = esite.hostmap;
			}
		});

		// apply server overrides.  things like port number
		_.extend(this.config.server, env.server);
	}
};

// create local utility function to apply the merge.
var mergeSection = function(parent, section, reverse) {
	var that = this,
		parentSection = parent[section] || {},
		thisSection = this[section] || {},
		keys = _.keys(parentSection).concat(_.keys(thisSection)),
		newSection = {};

	_.each(keys, function(key) {
		var thisThing = (thisSection[key] || {}),
			parentThing = (parentSection[key] || {});

		// if the property explicitly exists, but is null then do not pull the parent version and do not add to object
		if (thisSection.hasOwnProperty(key) && thisSection[key] === null) {
			// do nothing.
		}
		// when the section/key prop exists, but is not explicitly null then we want to merge the props.  
		else if (reverse) {
			newSection[key] = _.clone(parentThing);
			newSection[key].module = newSection[key].module || thisThing.module;
			newSection[key].options = _.merge(thisThing.options || {}, newSection[key].options);
		}
		else {
			newSection[key] = _.clone(thisThing);
			newSection[key].module = newSection[key].module || parentThing.module;
			newSection[key].options = _.merge(parentThing.options || {}, newSection[key].options);
		}

	});	

	this[section] = newSection;

};

module.exports = Config;

