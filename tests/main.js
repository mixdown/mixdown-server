var mixdown = require('../index'),
	path = require('path'),
	http = require('http'),
	cluster	= require('cluster'),
	serverConfig = new mixdown.Config(require(__dirname + '/server.json')),
	tap = require('tap'),
	test = tap.test;

// wire up error event listeners before initializing config.
serverConfig.on('error', function(err) {
	console.info(err);
});
serverConfig.init();

var main = mixdown.MainFactory.create({
	packageJSON: require('../package.json'),
	serverConfig: serverConfig
});

main.start(function(err, options) {

	console.log(JSON.stringify(Object.keys(options)));

	var serverConfig = options.serverConfig,
		workers = options.workers,
		server = options.server;

	test('Insure server and config exist', function(t) {

		t.ok(serverConfig, "serverConfig should exist");

		if (cluster.isMaster) {
			t.equal(Object.keys(workers).length, 2, "2 Clustered workers should have started");
			t.ok(server, "Server should exist");
		}

		t.end();
	});

	var homeurl = 'http://localhost:' + serverConfig.server.listen.port + '/';

	test('Request Home Page (worker: ' + process.pid + ') - ' + homeurl, function(t) {
		var gold = '<html> <body> <p>Each test</p> <ul> <li>Hola world (spanish)</li> <li>Bonjour world (french)</li> <li>Hello world (english)</li> </ul> <p>Range test</p> <ul> <li>key: 0, value: 0</li> <li>key: 1, value: 1</li> <li>key: 2, value: 2</li> <li>key: 3, value: 3</li> <li>key: 4, value: 4</li> <li>key: 5, value: 5</li> <li>key: 6, value: 6</li> <li>key: 7, value: 7</li> <li>key: 8, value: 8</li> <li>key: 9, value: 9</li> </ul> <p>ifeval test - Pass </p> <p>def test - German Not Found</p>';

		var req = http.get(homeurl, function(res) {
			var buf = '';

			t.equal(res.statusCode, 200, "Home page should send a 200 response");

			res.on('data', function(chunk) {
				buf += chunk;
			})
			.on('end', function() {
				buf = buf.replace(/\s+/g, ' ').trim();
				t.equal(buf, gold, "Home page response should match the expected html response");
				t.end();
			})
			.on('error', function(err) {
				t.notOk(err, "Should not be error on home page response");
				t.end();
			});
		});

		req.on('error', function(err) {
			if (err) {
				console.log(err);
			}
			t.notOk(err, "Should not be error on home page request");
			t.end();
		});
	});

});
	

