var Gateway = require('./lib/xgateway/xgateway.js');

var config = {
	clientListenerCfg:{
		host: '192.168.1.133',
		port: 9270
	},
	serverListenerCfg:{
		host: '192.168.1.133',
		port: 9271
	}
};

var app = new Gateway(config);

app.start();
