var util = require('util'),
    events = require('events'),
    fs = require('fs'),
    async = require('async'),
    broadway = require('broadway'),
		App = require('./app.js'),
		_ = require('lodash'),
		pluginUtil = require('./pluginutil.js');

/**
 * 
 *	Config - loads and manages configuration for environment and sites.
 * 	@param config - Object containing the server configuration.
**/
var Config = function(config) {
	this.config = config;
	this._originalconfig = _.clone(config);
	this._externalConfig = null;
};

util.inherits(Config, events.EventEmitter);

Config.prototype.init = function(callback) {
	this.server = this.config.server;

	var that = this;
	this.getExternalConfig(function(err, extConfig) {

		if (err) {
			_.isFunction(callback) ? callback(err) : null;
			return;
		}

		if (extConfig) {

			extConfig.getSites(function(err, sites) {
				if (err) {
					_.isFunction(callback) ? callback(err) : null;
				}

				that.updateSites(sites);
				that.initApps(callback);
			});

		}
		else {
			that.initApps(callback);
		}

	});
};

Config.prototype.initApps = function(callback) {
	var apps = {};
	var inits = [];
	var raw = this.config;
	var that = this;

	// enumerate and create the apps
	_.each(raw.sites, function(site) {

		_.bind(mergeSection, site, raw.app, 'plugins')();
		site.server = raw.server;
		var app = new App(site);

		app.on('error', function(err) {
			that.emit('error', err);
		});

		app.id = site.id;
		apps[site.id] = app;

		// enqueue the app init so we can attach a cb to the entire thing.
		inits.push(_.bind(app.init, app));
	});

	// async the inits and notify when they are done.
	// TODO: see if a single app failure could cause all apps to fail.
	async.parallel(inits, function(err) {
		if (!err) {
			that.apps = apps;
		}
		_.isFunction(callback) ? callback(err, that) : null;
	});

}

Config.prototype.getExternalConfig = function(callback) {
	if (this.server.externalConfig && this._externalConfig) {
		_.isFunction(callback) ? callback(null, this._externalConfig) : null;
		return;
	}
	else if (!this.server.externalConfig) {
		_.isFunction(callback) ? callback() : null;
		return;
	}

	// new bw to attach dist config module.
	var app = new broadway.App();
	var that = this;

	// resolve and attach dist config module.
	pluginUtil.use({
		plugin: this.server.externalConfig,
		app: app
	});

	app.externalConfig.once('sites', function(sites) {
		that.updateSites(sites);
		that.initApps();
	});

	// initialize dist config module
	app.init(function(err) {
	
		if (!err) {
			that._externalConfig = app.externalConfig;
		}
		_.isFunction(callback) ? callback(err, that._externalConfig) : null;

	});
};

/**
* Applies the overrides for all sites with changes.  Useful for updating 1 or more sites out of band, then applying configuration overrides.
* @param sites - Array of site overrides for this config.
**/
Config.prototype.updateSites = function(sites) {

	// generate a hash of all of the keys
	var keys = {};
	var that = this;
	var newSitesArray = [];

	_.each(this._originalconfig.sites, function(s) {
		keys[s.id] = true;
	});

	_.each(sites, function(s) {
		keys[s.id] = true;
	});

	_.each(this.config.sites, function(s) {
		keys[s.id] = true;
	});

	_.each(keys, function(junk, key) {
		var origConfig = _.find(that._originalconfig.sites, function(s) { return s.id == key; });
		var overrideConfig = _.find(sites, function(s) { return s.id == key; });
		var newConfig = null;

		// we have an original config from file and we have a override config, then merge them.
		if (origConfig && overrideConfig) {
			newConfig = _.clone(origConfig);

			// apply overrides of plugins
			_.bind(mergeSection, newConfig, overrideConfig, 'plugins', true)();

			// apply overrides of hostmap
			newConfig.hostmap = overrideConfig.hostmap;
		}

		// there is only an override config, then use it.
		else if (overrideConfig) {
			newConfig = _.clone(overrideConfig);
		}

		// there is only an original config from file.
		else if (origConfig) {
			newConfig = _.clone(origConfig);
		}

		// there is no original file based config and the updated site is not in the override array.
		// This happens when a site is loaded from external config initially, then a single other site is being 
		// updated that is not this one.  
		// Ex: site A & B are both loaded from ext config.  Then site B is updated from ext config.  Site B is the only 
		// item in the sites array in this function, but that does not mean that we want site A to stop working.  
		else {
			newConfig = _.find(that.config.sites, function(s) { return s.id == key; });
		}

		if (newConfig) {

			// replace the active site in the array
			newSitesArray.push(newConfig);
		}

	});

	// swap the active site array
	this.config.sites = newSitesArray;
}

/**
* Applies the overrides from the env config.  Useful for setting a base config, then applying configuration overrides.
* @param env - String representing the env overrides for this config.  This will load the config 
**/
Config.prototype.env = function(env) {

	if (env) {

		// apply merge of plugins at app level
		if (env.app) {
			_.bind(mergeSection, this.config.app, env.app, 'plugins', true)();
		}

		// apply env config to sites.
		this.updateSites(env.sites);

		// since this is an env override, then it should be applied and held as the original config so that 
		// updates from dist config can be applied to the original config, not the prev version of config.
		this._originalconfig = _.cloneDeep(this.config);

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
			newSection[key].options = _.merge( _.cloneDeep(thisThing.options) || {}, newSection[key].options);
		}
		else {
			newSection[key] = _.clone(thisThing);
			newSection[key].module = newSection[key].module || parentThing.module;
			newSection[key].options = _.merge( _.cloneDeep(parentThing.options) || {}, newSection[key].options);
		}

	});	

	this[section] = newSection;

};

module.exports = Config;

