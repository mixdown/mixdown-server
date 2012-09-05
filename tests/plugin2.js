var Hello = function() {};

Hello.prototype.attach = function(options) {
	this.api2 = function(callback) {
		callback(null, { 
			languages: {
				spanish: {
					hello: 'Hola' 
				},
				german: {
					hello: "Servus"
				},
				english: {
					hello: 'Hello'
				}
			}
		});
	}
};
module.exports = Hello;