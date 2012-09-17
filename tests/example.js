var mixdown = require('../index'),
	serverConfig = new mixdown.Config(require("./server.json"));

serverConfig.on('error', function(err) {
	console.log(err);
	process.exit();
});

serverConfig.env(require("./server-override.json"));
serverConfig.init();

// start server.  Sets up server, port, and starts the app.
var server = new mixdown.Server(serverConfig);

server.start(function(err) {
	if (err) {
		console.log("Could not start server.  Stopping process.", err, err.stack);
		process.exit();
	}
	else {
		console.log("Server started successfully.", serverConfig);
	}
});