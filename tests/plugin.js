var Hello = function() {};

Hello.prototype.attach = function(options) {
	this.api = function(callback) {
		callback(null, { 
			languages: {
				spanish: {
					hello: 'Hola' 
				},
				french: {
					hello: "Bonjour"
				},
				english: {
					hello: 'Hello'
				}
			}
		});
	}
};

module.exports = Hello;