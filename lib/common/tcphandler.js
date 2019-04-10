var logger = require('../log/xgateway.js').logger("info");

var TcpHandler = function(socket, way) {
	this.socket = socket;
	this.guid = 0;
	this.dstGuid = 0;
	this.type = 0;
	this.way = way;
}

TcpHandler.prototype.send = function(messageBuff) {
	if('socket.io' == this.way) {
		this.socket.emit('data',messageBuff);
	}
	if('net' == this.way) {
		//logger.info('messageBuff =', messageBuff);
		this.socket.write(messageBuff);
	}

};

module.exports = TcpHandler;