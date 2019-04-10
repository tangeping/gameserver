var logger = require('../log/mahjong.js').logger("info");
var net = require('net');
var message = require('../gpb/game_client_pb.js');
var common  = require('../gpb/common_pb.js');
var dataBuffer = require('./databuffer.js');
var roomMgr = require('./roommgr.js');

var protoCMD = proto.proto.cmd;

var GwConnector = function(serverId, serverType, config, mahjong) {
	this.serverId = serverId;
	this.serverType = serverType;

	this.gatewayServer = {
		host: config.gatewayServer.host,
		port: config.gatewayServer.port
	};

	this.gateway = null;
	this.mahjong = mahjong;

	this.remainData = null;
	this.needDataLength = 0;
};

module.exports = GwConnector;

GwConnector.prototype.registServer = function() {
	logger.info('registServer start');
	let protoHead = new common.head();
	let protoHeadSrc = new common.head.src_type();
	let protoHeadDst = new common.head.dst_type();
	protoHeadSrc.setType(this.serverType);
	protoHeadSrc.setId(this.serverId);
	protoHead.setSrc(protoHeadSrc);
	protoHeadDst.setType(proto.common.end_point.EMEPTYPE_GATEWAY);
	protoHeadDst.setIdList(0);
	protoHead.setDst(protoHeadDst);
	let dataBuff = new dataBuffer();
	dataBuff.writeBinary(protoHead.serializeBinary().buffer);
	let protoReqServerRegist = new message.CProtoReqServerRegist();
	protoReqServerRegist.setBeginRoomId(0);
	protoReqServerRegist.setEndRoomId(1000);
	protoReqServerRegist.setGameType(3);
	protoReqServerRegist.setStartTime(Math.floor(Date.now()/1000));
	dataBuff.writeBinary(protoReqServerRegist.serializeBinary().buffer);
	dataBuff.writeEnd(protoCMD.REQSERVERREGIST);
	let sendData = dataBuff.dataBuffer;
	this.gateway.write(sendData);
	logger.info('registServer end');
};

GwConnector.prototype.sendToClient = function(mid, cmd, message) {
	logger.info('SendToClient start');
	logger.info('message = ', message.toObject());
	let protoHead = new common.head();
	let protoHeadSrc = new common.head.src_type();
	let protoHeadDst = new common.head.dst_type();
	protoHeadSrc.setType(this.serverType);
	protoHeadSrc.setId(this.serverId);
	protoHead.setSrc(protoHeadSrc);
	protoHeadDst.setType(proto.common.end_point.EMEPTYPE_CLIENT);
	protoHeadDst.addId(mid);
	protoHead.setDst(protoHeadDst);
	let dataBuff = new dataBuffer();
	dataBuff.writeBinary(protoHead.serializeBinary().buffer);
	dataBuff.writeBinary(message.serializeBinary().buffer);
	dataBuff.writeEnd(cmd);
	let sendData = dataBuff.dataBuffer;
	//logger.info(sendData);
	this.gateway.write(sendData);
	logger.info('SendToClient end');
};

GwConnector.prototype.readStream = function(recvData) {
	let totalData = null;
	if(this.remainData){
		totalData = Buffer.alloc(this.remainData.length + recvData.length);
		this.remainData.copy(totalData);
		recvData.copy(totalData, this.remainData.length);
	}
	else{
		totalData = recvData;
	}

	if(0 == this.needDataLength){
		this.needDataLength = totalData.readInt16LE(dataBuffer.PACKET_SIZE_OFFSET);
	}
	if(this.needDataLength + dataBuffer.PACKET_DATA_OFFSET == totalData.length) {
		this.needDataLength = 0;
		this.remainData = null;
		this.mahjong.onMessage(totalData);
	} else if(this.needDataLength + dataBuffer.PACKET_DATA_OFFSET > totalData.length) {
		this.remainData = totalData;
	} else {
		this.remainData = Buffer.alloc(totalData.length - this.needDataLength - dataBuffer.PACKET_DATA_OFFSET);
		totalData.copy(this.remainData, 0, 0, this.needDataLength + dataBuffer.PACKET_DATA_OFFSET);
		this.needDataLength = 0;
		this.mahjong.onMessage(Buffer.from(totalData.buffer, 0, this.needDataLength + dataBuffer.PACKET_DATA_OFFSET));
		if(this.remainData.readInt16LE(dataBuffer.PACKET_SIZE_OFFSET) + dataBuffer.PACKET_DATA_OFFSET <= this.remainData.length){
			this.readStream(this.remainData);
		}
	}
};

GwConnector.prototype.connectGateWay = function() {
	let self = this;
	this.gateway = net.createConnection(this.gatewayServer,() => {
		logger.info('connection');
		self.registServer();
	});

	this.gateway.on('data', function(data) {
		logger.info('data size =', data.length);
		self.readStream(data);


		//test 残包
		// self.readStream(Buffer.from(data.buffer,0, 8));
		// self.readStream(Buffer.from(data.buffer,8, data.length - 8));


		//test 粘包
		// if(!self.remainData){
		// 	self.remainData = data;
		// }
		// else{
		// 	self.readStream(Buffer.from(data.buffer,0, 8));
		// 	self.readStream(Buffer.from(data.buffer,8, data.length - 8));
		// }

		//self.mahjong.onMessage(data);
	});

	this.gateway.on('close', function() {
		logger.info('close');
		self.connectGateWay();
		//self.mahjong.gwConnector = self;
		//self.gateway.connect(self.gatewayServer);
	});

	this.gateway.on('error', function(error) {
		logger.error(error);
	});
};
