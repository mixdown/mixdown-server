var util = require('util'),
    events = require('events'),
    fs = require('fs'),
	App = require('./app'),
	_ = require('lodash');

/**
 * 
 *	Config - loads and manages configuration for environment and sites.
 * 	options: {
 * 		configManager: the configuration manager for this app (this is injected to support unit testing separate from app instantiation)
 * 		sitepath: path to the site folder
 * 	}
**/
var Config = function() {};

util.inherits(Config, events.EventEmitter);

Config.prototype.init = function(raw) {
	var that = this;

	this.server = raw.server;
	this.apps = {};

	// enumerate and create the apps
	_.each(raw.sites, function(site) {
		_.bind(mergeSection, site, raw.app, 'plugins')();
		var app = new App(site);

		app.on('error', function(err) {
			that.emit('error', err);
		});

		app.init();
		that.apps[site.id] = app;
	});

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
			newSection[key].options = _.extend(thisThing.options || {}, newSection[key].options);
		}
		else {
			newSection[key] = _.clone(thisThing);
			newSection[key].module = newSection[key].module || parentThing.module;
			newSection[key].options = _.extend(parentThing.options || {}, newSection[key].options);
		}

	});	

	this[section] = newSection;

};

module.exports = Config;

