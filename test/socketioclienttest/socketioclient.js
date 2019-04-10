var socket = require('socket.io-client')('http://192.168.1.133:9270');
//var arrayBuff = new ArrayBuffer(16);
// var dataView = new DataView(arrayBuff);

// dataView.setUint16(0,21329,true);
// dataView.setUint16(2,10,true);
// dataView.setUint16(4,15,true);
// dataView.setUint8(6,1);
// dataView.setUint16(8,10,true);
// dataView.setUint16(10,10,true);
// dataView.setUint16(12,10,true);

// dataView.setUint16(0,21329);
// dataView.setUint16(2,10);
// dataView.setUint16(4,15);
// dataView.setUint8(6,1);
// dataView.setUint16(11,1);

var arrayBuff = new Buffer([81, 83, 76, 0, 1, 0, 1, 0, 0, 0, 0, 67, 0, 0, 0, 8, 177, 151, 7, 18, 32, 54, 99, 54, 97, 51, 55, 100, 97, 49, 102, 52, 53, 98, 102, 48, 100, 57, 50, 48, 57, 51, 53, 100, 49, 98, 55, 55, 54, 48, 56, 52, 97, 24, 211, 148, 163, 213, 5, 34, 20, 10, 2, 49, 54, 18, 5, 49, 46, 48, 46, 49, 26, 7, 119, 105, 110, 100, 111, 119, 115, 0]);

console.log(arrayBuff);
var array = new Uint8Array(67);
for(let i = 0; i < 67; i++) {
	console.log('i =',i , arrayBuff.readUInt8(15 + i));
	array[i] = arrayBuff.readUInt8(15 + i);
}
console.log(array);
console.log(arrayBuff.buffer);
let retBuff = Buffer.from(arrayBuff.buffer, 0, 1);
console.log(retBuff);
socket.emit('data', arrayBuff);
socket.on('data', function(data){
	console.log('data', data);
});
socket.on('disconnect',function(data){
	console.log('disconnect');
});
