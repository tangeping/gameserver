var net = require('net');

var server = new net.Socket();
server.connect(9291, '127.0.0.1', function() {
    console.log('Connected');
    server.write('Hello, server! Love, Client.');
});

server.on('data', function(data) {
    console.log('Received: ' + data);
});

server.on('close', function() {
    console.log('Connection closed');
});