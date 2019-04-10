const server = require('http').createServer();

const io = require('socket.io')(server);

io.on('connection',function(socket){
	socket.emit('data',Buffer.from([12,34]));
	socket.on('data',function(data) {
		let myData = data;
		console.info(Buffer.from(myData));
		console.log('cmd =', Buffer.from(myData).readUInt16LE(4));
		console.log('cmd =', Buffer.from(myData).readUInt16LE(4));
	})
});

server.listen({host:'192.168.1.133',port:9273});