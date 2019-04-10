var message = require('./game_pb.js');

var protoClientHead = new proto.CProtoClientHead();

var buffClientHead= protoClientHead.serializeBinary();

// var buffClientHead = new Uint8Array(1);

// buffClientHead[0] = 0;

console.log(buffClientHead.length);

var desProto = new proto.CProtoClientHead.deserializeBinary(buffClientHead);

console.log(desProto);