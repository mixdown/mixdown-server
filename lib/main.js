exports.create = function(options, callback) {
	var rootpath = options.rootpath,
		packageJSON = options.packageJSON || {};

	var _ = require('lodash'),
		opt = require('optimist'),
		util = require('util'),
		argv = opt
			.alias('h', 'help')
			.alias('?', 'help')
			.describe('help', 'Display help')
			.usage('Starts ' + packageJSON.name + ' framework for serving multiple sites.\n\nVersion: ' + packageJSON.version + '\nAuthor: ' + packageJSON.author)
			.alias('v', 'version')
			.describe('version', 'Display Mixdown application version.')
			.argv,
		mixdown = require('../index'),
	    serverConfig = new mixdown.Config(require(rootpath + '/server.json')),
	    envConfig = null,
	    server = null;

	if(argv.help) {
		opt.showHelp();
		return {
			server: server,
			serverConfig: serverConfig
		};
	}

	try {
		envConfig = require(rootpath + '/server-' + process.env.MIXDOWN_ENV + '.json');
	}
	catch (e) {}

	// Init logger: Need to move this to external place where is can be injected with 
	// alpha, beta, and prod settings
	global.logger = mixdown.Logger.create( (envConfig && envConfig.config ? envConfig.config.server.logger : null) || serverConfig.config.server.logger);

	if (!logger) {
		console.log('There is no logger declared.  Exiting process.');
		process.exit();
	}

	// http://nodejs.org/api/http.html#http_http_globalagent
	var ga = require("http").globalAgent;
	ga.maxSockets = 500;
	logger.info('globalAgent.maxSockets: ' + ga.maxSockets);

	if(argv.version) {
		console.log(packageJSON.version);
		return;
	}

	serverConfig.on('error', function(err) {
		console.info(err);
	})

	if (envConfig) {
		serverConfig.env(envConfig);
	}

	serverConfig.init();

	var createServer = function(done) {
		// start server.  Sets up server, port, and starts the app.
		var mserver = new mixdown.Server(serverConfig);

		mserver.start(function(err, data) {
			if (err) {
				logger.critical("Could not start server.  Stopping process.", err);
				process.exit();
			}
			else {
				var hmap = [];
				_.each(serverConfig.apps, function(app) { 
					hmap.push({ 
						hostmap: app.config.hostmap,
						id: app.config.id
					});
				});
				logger.info("Server started successfully listening on " + util.inspect(data.socket.address()) + ". " + util.inspect(hmap) );

				data.server = mserver;
				done(err, data);
			}
		});
	};

	// Start cluster.

	var children = {};

	if(serverConfig.server.cluster && serverConfig.server.cluster.on){
		/*logger.debug*/ logger.info("Using cluster");
		
		var numCPUs = serverConfig.server.cluster.workers || require('os').cpus().length,
			cluster	= require('cluster');
		
		if(cluster.isMaster){
			logger.info("Starting master with " + numCPUs + " CPUs");

			// spawn n workers
			for (var i = 0; i < numCPUs; i++) {
				var child = cluster.fork();
				children[child.process.pid] = child;
			}

			// Add application kill signals.
			var signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
			_.each(signals, function(sig) {

				process.on(sig, function() {

					_.each(children, function(child) {
						child.destroy();  // send suicide signal
					});

					// create function to check that all workers are dead.
					var checkExit = function() {
						if (_.keys(children).length == 0) {
							process.exit();
						}
						else {
							process.nextTick(checkExit);   // keep polling for safe shutdown.
						}
					};

					// poll the master and exit when children are all gone.
					process.nextTick(checkExit);
					
				});

			});

			cluster.on('exit', function(worker) {
				logger.error('Worker exited unexpectedly. Spawning new worker', worker);

				// remove the child from the tracked running list..
				delete children[worker.process.pid];

				// if it purposely destroyed itself, then do no re-spawn.  
				// Otherwise, it was killed for some external reason and should create a new child in the pool.
				if (!worker.suicide) {

					// spawn new child
					var child = cluster.fork();
					children[child.process.pid] = child;
				}
				 
			});

		} else {
			/*logger.debug*/ logger.info("Worker ID", process.env.NODE_WORKER_ID);
			server = createServer(function(err, data) {
				data.serverConfig = serverConfig;
				data.workers = children;
				callback(null, data);
			});
		}
		
	} 
	else {
		server = createServer(function(err, data) {
			data.serverConfig = serverConfig;
			data.workers = children;
			callback(null, data);
		});
	}
};

