var logger = require('../log/xgateway.js').logger("info");
var net = require('net');
require('../gpb/game_client_pb.js');
require('../gpb/common_pb.js');
var io = require('socket.io');
var dataBuffer = require('../mahjong/databuffer.js');
var tcpHandler = require('../common/tcphandler');
var md5 = require('md5');

var fs = require('fs');

var protoCMD = proto.proto.cmd;
var protoMsg = proto.proto;
var protoCommon = proto.common;

var GameCfgType = function() {
	this.id = 0;
	this.beginRoomId = 0;
	this.endRoomId = 0;
	this.startTime = 0;
	this.gameType = 0;
}

var Gateway = function(config) {
	this.gatewayApp = null;
	this.gatewayIo = null;
	this.serverListener = null;
	this.clientListener = null;
	this.clients = new Map();
	this.servers = new Map();
	this.clientsToGame = new Map();
	this.gameCfg = new Map();
	this.clientListenerCfg = {
		host: config.clientListenerCfg.host,
		port: config.clientListenerCfg.port
	};
	this.serverListenerCfg = {
		host: config.serverListenerCfg.host,
		port: config.serverListenerCfg.port
	};

	this.remainDataClient = null;
	this.needDataLengthClient = 0;

	this.remainDataServer = null;
	this.needDataLengthServer = 0;
};

Gateway.CMDTYPE = {
	emCMDTYPE_ERROR:0,//错误
	emCMDTYPE_CLIENT_TO_MAHJONG:1,//客户端到麻将服务器（大致是这样）
	emCMDTYPE_CLIENT_TO_HALL:2,//客户端到大厅服务器
	emCMDTYPE_CLIENT_TO_POKER:3,//客户端到poker服务器
	emCMDTYPE_SERVER_INNER:4,//服务器内部通信
	emCMDTYPE_UNKNOWN:5
};

Gateway.prototype.getCMDType = function(cmd) {
	if (cmd <= 0) {
		return Gateway.CMDTYPE.emCMDTYPE_ERROR;
	} else if (cmd <= protoCMD.CLIENT_TO_GAME_CMD_END) {
		return Gateway.CMDTYPE.emCMDTYPE_CLIENT_TO_MAHJONG;
	} else if (cmd <= protoCMD.CLIENT_CMD_END) {
			return Gateway.CMDTYPE.emCMDTYPE_CLIENT_TO_HALL;
	} else if (cmd <= protoCMD.SERVER_INNER_CMD_END) {
		return Gateway.CMDTYPE.emCMDTYPE_SERVER_INNER;
	} else if (cmd <= protoCMD.CLINENT_TO_POKER_CMD_END) {
		return Gateway.CMDTYPE.emCMDTYPE_CLIENT_TO_POKER;
	} else {
		return Gateway.CMDTYPE.emCMDTYPE_UNKNOWN;
	}
};

Gateway.prototype.ClientListen = function() {
	logger.info('ClientListen start');
	var self = this;
	this.gatewayApp = require('http').createServer(function(){
		logger.info('createServer callback');
	});
	this.gatewayIo = io(this.gatewayApp);
	this.gatewayIo.on('connection', function(socket){
		logger.info('connection');
		let handler = new tcpHandler(socket,'socket.io');
		self.OnCreateClientServer(handler);
	});
	this.gatewayApp.listen(this.clientListenerCfg);
};

// Gateway.prototype.ClientListen = function() {
// 	var self = this;
// 	this.clientListener = net.createServer(function(socket) {
// 		let handler = new tcpHandler(socket, 'net');
// 		self.OnCreateClientServer(handler);
// 	});

// 	this.clientListener.listen({
// 		host: this.clientListenerCfg.ip,
// 		port: this.clientListenerCfg.port,
// 		exclusive: true
// 	});
// };


Gateway.prototype.ServerListen = function() {
	let self = this;
	this.serverListener = net.createServer(function(socket) {
		let handler = new tcpHandler(socket, 'net');
		self.OnCreateServerServer(handler);
	});

	this.serverListener.listen({
		host: this.serverListenerCfg.ip,
		port: this.serverListenerCfg.port,
		exclusive: true
	});
};

Gateway.prototype.readClientStream = function(handler, recvData) {
	logger.info('recvData length =', recvData.length);
	let totalData = null;
	if (this.remainDataClient != null){
		totalData = Buffer.alloc(this.remainDataClient.length + recvData.length);
		this.remainDataClient.copy(totalData);
		recvData.copy(totalData, this.remainDataClient.length);
	} else {
		totalData = recvData;
	}

	if (0 == this.needDataLengthClient){
		this.needDataLengthClient = totalData.readInt16LE(dataBuffer.PACKET_SIZE_OFFSET);
	}
	logger.info(totalData);
	logger.info('need length = ', this.needDataLengthClient, ' data length =', totalData.length);
	if (this.needDataLengthClient + dataBuffer.PACKET_DATA_OFFSET == totalData.length) {
		this.needDataLengthClient = 0;
		this.remainDataClient = null;
		this.OnClientMessage(handler, totalData);
	} else if (this.needDataLengthClient + dataBuffer.PACKET_DATA_OFFSET > totalData.length) {
		this.remainDataClient = totalData;
	} else {
		this.remainDataClient = Buffer.alloc(totalData.length - this.needDataLengthClient - dataBuffer.PACKET_DATA_OFFSET);
		totalData.copy(this.remainDataClient, 0, this.needDataLengthClient + dataBuffer.PACKET_DATA_OFFSET);
		this.needDataLengthClient = 0;
		this.OnClientMessage(handler, Buffer.from(totalData, 0, this.needDataLengthClient + dataBuffer.PACKET_DATA_OFFSET));
		if (this.remainDataClient.readInt16LE(dataBuffer.PACKET_SIZE_OFFSET) + dataBuffer.PACKET_DATA_OFFSET <= this.remainDataClient.length){
			let tmpRemainDataClient = this.remainDataClient;
			this.remainDataClient = null;
			this.readClientStream(handler, tmpRemainDataClient);
		}
	}
};


Gateway.prototype.OnCreateClientServer = function(handler) {
	logger.info('OnCreateClientServer');
	var self = this;
	this.OnClientConnect(handler);
	handler.socket.on('data',function(data){
		self.readClientStream(handler, data);
		//self.OnClientMessage(handler, data);
	});

	handler.socket.on('disconnect',function(){
		self.OnClientClose(handler);
	});
	handler.socket.on('error',function(){
		logger.error('error');
		self.OnClientClose(handler);
	});
};

Gateway.prototype.readServerStream = function(handler, recvData) {
	//logger.info('recvData length =', recvData.length);
	let totalData = null;
	if (this.remainDataServer != null){
		totalData = Buffer.alloc(this.remainDataServer.length + recvData.length);
		this.remainDataServer.copy(totalData);
		recvData.copy(totalData, this.remainDataServer.length);
	} else {
		totalData = recvData;
	}

	if (0 == this.needDataLengthServer){
		this.needDataLengthServer = totalData.readInt16LE(dataBuffer.PACKET_SIZE_OFFSET);
	}
	//logger.info(totalData);
	//logger.info('need length = ', this.needDataLengthServer, ' data length =', totalData.length);
	if (this.needDataLengthServer + dataBuffer.PACKET_DATA_OFFSET == totalData.length) {
		this.needDataLengthServer = 0;
		this.remainDataServer = null;
		this.OnServerMessage(handler, totalData);
	} else if (this.needDataLengthServer + dataBuffer.PACKET_DATA_OFFSET > totalData.length) {
		this.remainDataServer = totalData;
	} else {
		this.remainDataServer = Buffer.alloc(totalData.length - this.needDataLengthServer - dataBuffer.PACKET_DATA_OFFSET);
		totalData.copy(this.remainDataServer, 0, this.needDataLengthServer + dataBuffer.PACKET_DATA_OFFSET);
		this.needDataLengthServer = 0;
		this.OnServerMessage(handler, Buffer.from(totalData, 0, this.needDataLengthServer + dataBuffer.PACKET_DATA_OFFSET));
		if (this.remainDataServer.readInt16LE(dataBuffer.PACKET_SIZE_OFFSET) + dataBuffer.PACKET_DATA_OFFSET <= this.remainDataServer.length){
			let tmpRemainDataServer = this.remainDataServer;
			this.remainDataServer = null;
			this.readServerStream(handler, tmpRemainDataServer);
		}
	}
};

Gateway.prototype.OnCreateServerServer = function(handler) {
	let self = this;
	this.OnServerConnect();
	handler.socket.on('data',function(data){
		//logger.info(data);
		//logger.info('cmd =', data.readInt16LE(dataBuffer.PACKET_CMD_OFFSET));
		//logger.info('data length =', data.readInt16LE(dataBuffer.PACKET_SIZE_OFFSET),
		//	'packet length =', data.length);
		self.readServerStream(handler, data);
		//self.OnServerMessage(handler, data);
	});

	handler.socket.on('end',function(){
		self.OnServerClose(handler);
	});

	handler.socket.on('error',function(){
		self.OnServerClose(handler);
		logger.error('error');
	});
};

Gateway.prototype.onPlayerLogin = function(handler, messageBuff) {
	logger.info('onPlayerLogin start');
	let err = 0;
	let protoReqLogin = new protoMsg.CProtoReqLogin.deserializeBinary(messageBuff);
	if(undefined == protoReqLogin) {
		logger.error('CProtoReqLogin parse failed,size =', messageBuff.length);
		this.sendErrorToClient(handler, protoMsg.error_code.ERROR_MSG_PARSE_FAILED);
	}
	logger.info(protoReqLogin.toObject());
	let mid = protoReqLogin.getMid();
	logger.info('mid =', mid);
	let remainGameServer = this.getDstGameId(mid);
	logger.error('remainGameServer = ', remainGameServer);

	//todo versioncompare();

	err = this.checkLoginToken(mid, protoReqLogin.getTime(), protoReqLogin.getToken());

	let ack = new protoMsg.CProtoRspLogin();
	ack.setMErrorcode(err);
	ack.setMSeed(1000);
	ack.setMId(mid);
	ack.setRemainGame(remainGameServer ? (remainGameServer > 0) : false);
	this.sendToClient(handler, protoCMD.RSPLOGIN, ack);

	if (err != 0) {
		return;
	}

	handler.type = protoCommon.end_point.EMEPTYPE_CLIENT;
	handler.guid = mid;
	if (this.clients.get(mid)) {
		this.sendToClient(handler, protoCMD.NOTIFYOTHERDEVICELOGIN);
		handler.guid = 0;
	}
	this.clients.set(mid, handler);

	let rspLoginBuff = ack.serializeBinary();

	let protoHead = new protoCommon.head();
	protoHead.getSrc().setType(protoCommon.end_point.EMEPTYPE_CLIENT);
	protoHead.getSrc().setId(mid);

	if (remainGameServer > 0) {
		protoHead.getDst().setType(protoCommon.end_point.EMEPTYPE_GAMESERVER);
		protoHead.getDst().addId(remainGameServer);
		this.sendToServer(protoCMD.RSPLOGIN, ack.serializeBinary().buffer, protoHead);
	}

	protoHead.getDst().setType(protoCommon.end_point.EMEPTYPE_HALL);
	protoHead.getDst().setIsBroad(true);
	this.sendToServer(protoCMD.RSPLOGIN, ack.serializeBinary().buffer, protoHead);

	logger.info('onPlayerLogin end');
};

Gateway.prototype.onHeartBeat = function(handler, messageBuff) {
	//logger.info('onHeartBeat start');
	let dataBuff = new dataBuffer();
	dataBuff.writeEnd(protoCMD.RSPHEARTBEAT);
	let sendData = dataBuff.dataBuffer;
	handler.send(sendData);
	//logger.info('onHeartBeat end');
};

Gateway.prototype.onAddNotifyAddCardCount = function(messageBuff) {
	logger.info('onAddNotifyAddCardCount start');
	let dstHandlerType = this.getServerHandlerByType(protoCommon.end_point.EMEPTYPE_HALL);
	if (!dstHandlerType) {
		logger.error('not find EMEPTYPE_HALL');
		return;
	}
	dstHandlerType.send(messageBuff);
	logger.info('onHeartBeat end');
};

Gateway.prototype.onGmCmd = function(messageBuff) {
	logger.info('onGmCmd start');
	let protoReqGmCmd = new protoMsg.CProtoReqGmCmd.deserializeBinary(messageBuff);
	if (!protoReqGmCmd) {
		return;
	}
	let cmd = protoReqGmCmd.getCmd();
	//TODo
	logger.info('ReqGmCmd cmd =', cmd);
	logger.info('onGmCmd end');
};

Gateway.prototype.OnClientConnect = function(handler){
	logger.info("OnClientConnect");

	logger.info(this.clients.size);
};

Gateway.prototype.OnClientMessage = function(handler, data){

	let recvDataBuff = new dataBuffer(data);
	cmd = recvDataBuff.cmd();
	if (cmd != protoCMD.REQHEARTBEAT) {
		logger.info("OnClientMessage start");
		logger.error(data);
		logger.info('cmd =', cmd);
	}
	if (!(Gateway.CMDTYPE.emCMDTYPE_CLIENT_TO_MAHJONG == this.getCMDType(cmd) ||
		Gateway.CMDTYPE.emCMDTYPE_CLIENT_TO_POKER == this.getCMDType(cmd) ||
		Gateway.CMDTYPE.emCMDTYPE_CLIENT_TO_HALL == this.getCMDType(cmd)
		)
	) {
		logger.error('unknown cmd =', cmd);
		this.sendErrorToClient(handler, protoMsg.error_code.ERROR_INVALID_CMD);
		return;
	}
	let headBuff = recvDataBuff.read();
	if (cmd != protoCMD.REQHEARTBEAT) {
		logger.info(headBuff);
	}
	let protoClientHead = new protoMsg.CProtoClientHead.deserializeBinary(headBuff);
	if (!protoClientHead){
		logger.error('CProtoClientHead parse failed');
		this.sendErrorToClient(handler, proto.error_code.ERROR_HEAD_PARSE_FAILED);
		return;
	}
	let messageBuff = recvDataBuff.read().buffer;
	//logger.info(Buffer.from(messageBuff));
	switch (cmd) {
	case protoCMD.REQLOGIN:
		this.onPlayerLogin(handler, messageBuff);
		break;
	case protoCMD.REQHEARTBEAT:
		this.onHeartBeat(handler, messageBuff);
		break;
	case protoCMD.NOTIFYADDCARDCOUNT:
		this.onAddNotifyAddCardCount(messageBuff);
		break;
	case protoCMD.REQGMCMD:
		this.onGmCmd(messageBuff);
		break;
	default:{
		logger.info('client cmd =', cmd);
		let dstHandlers = new Array();
		this.judgeServerHandler(cmd, handler, protoClientHead, dstHandlers);
		let protoHead = new protoCommon.head();
		protoHead.getSrc().setType(protoCommon.end_point.EMEPTYPE_CLIENT);
		protoHead.getSrc().setId(handler.guid);
		protoHead.getDst().setType(0);
		protoHead.getDst().addId(0);
		let dataBuff = new dataBuffer();
		dataBuff.writeBinary(protoHead.serializeBinary().buffer);
		dataBuff.writeBinary(messageBuff);
		dataBuff.writeEnd(cmd);
		let sendData = dataBuff.dataBuffer;
		let count = 0;
		for (let eachDstHandler of dstHandlers) {
			if(!eachDstHandler) {
				logger.error('not find dstHandler, cmd =', cmd, ', protoHead = ', protoHead.toObject());
				continue;
			}
			eachDstHandler.send(sendData);
			count++;
		}
		if (count <= 0) {
			logger.error('not find dstHandler, cmd =', cmd, ', protoHead = ', protoHead.toObject());
			this.sendErrorToClient(handler, protoMsg.error_code.ERROR_NOT_FOUND_SERVER);
		}
	}
	}
};

Gateway.prototype.OnClientClose = function(handler){
	logger.info('OnClientClose');
	if (handler.guid <= 0) {
		return 0;
	}
	logger.info('client close mid =', handler.guid);
	this.clients.delete(handler.guid);
	let protoHead = new protoCommon.head();
	protoHead.getSrc().setType(protoCommon.end_point.EMEPTYPE_CLIENT);
	protoHead.getSrc().setId(handler.guid);

	protoHead.getDst().setIsBroad(true);
	protoHead.getDst().setType(protoCommon.end_point.EMEPTYPE_GAMESERVER);
	this.sendToServer(protoCMD.NOTIFYCLIENTCLOSED, null, protoHead);

	protoHead.getDst().setIsBroad(true);
	protoHead.getDst().setType(protoCommon.end_point.EMEPTYPE_HALL);
	this.sendToServer(protoCMD.NOTIFYCLIENTCLOSED, null, protoHead);

	logger.info(this.clients.size);
};

Gateway.prototype.serverRegist = function(handler, type, id, messageBuff) {
	logger.info('serverRegist');
	let protoReqServerRegist = new protoMsg.CProtoReqServerRegist.deserializeBinary(messageBuff);
	if (!protoReqServerRegist) {
		logger.error('deserializeBinary failed');
		return protoMsg.error_code.ERROR_MSG_PARSE_FAILED;
	}

	if (this.servers.has(id)) {
		logger.error('servers has id =', id);
		return protoMsg.error_code.ERROR_REGIST_ID_CONFLICT;
	}

	if (type == protoCommon.end_point.EMEPTYPE_GAMESERVER) {
		logger.info('game server regist');
		let canServerRegist = true;
		for(let [eachServerId, eachCfg] of this.gameCfg) {
			if (id == eachServerId) {
				canServerRegist = false;
				break;
			}
			if (eachCfg.beginRoomId <= protoReqServerRegist.getEndRoomId() && 
				eachCfg.endroomId <= protoReqServerRegist.getEndRoomId() ) {
				canServerRegist = false;
				break;
			}
			if (eachCfg.beginRoomId <= protoReqServerRegist.getBeginRoomId() &&
				eachCfg.beginRoomId <= protoReqServerRegist.getEndRoomId()) {
				canServerRegist = false;
				break;
			}
		}
		logger.info('canServerRegist =',canServerRegist);
		if (!canServerRegist){
			logger.error('gameCfg regist conflict, id =', id , ',beginRoomId =',
				protoReqServerRegist.getBeginRoomId(), ',endRoomId =', protoReqServerRegist.getEndRoomId());
			return protoMsg.error_code.ERROR_REGIST_ROOM_CONFLICT;
		}
		let regGameCfg = new GameCfgType();
		regGameCfg.id = id;
		regGameCfg.beginRoomId = protoReqServerRegist.getBeginRoomId();
		regGameCfg.endRoomId = protoReqServerRegist.getEndRoomId();
		regGameCfg.gameType = protoReqServerRegist.getGameType();
		regGameCfg.startTime = protoReqServerRegist.getStartTime();
		this.gameCfg.set(id, regGameCfg);
		logger.info('regist game cfg =', regGameCfg);
	} else {
		logger.info('xlogger regist');
		for( let [eachServerId, eachServer] of this.servers) {
			if(eachServer.type == type) {
				return protoMsg.error.ERROR_REGIST_TYPE_CONFLICT;
			}
		}
	}

	logger.info('server, type =', type, ", id =", id);
	handler.type = type;
	handler.guid = id;
	this.servers.set(id, handler);
	return 0;
};

Gateway.prototype.onServerRegist = function(handler, srcType, srcId, messageBuff) {
	logger.info('onServerRegist start');
	let err = this.serverRegist(handler, srcType, srcId, messageBuff);

	let protoRspServerRegist = new protoMsg.CProtoRspServerRegist();
	protoRspServerRegist.setErr(err);

	let protoHead = new protoCommon.head();
	protoHead.getSrc().setType(protoCommon.end_point.EMEPTYPE_GATEWAY);
	protoHead.getSrc().setId(0);
	protoHead.getDst().setIsBroad(false);
	protoHead.getDst().addId(srcId);
	protoHead.getDst().setType(protoCommon.end_point.EMEPTYPE_GAMESERVER);

	let dataBuff = new dataBuffer();
	dataBuff.writeBinary(protoHead.serializeBinary().buffer);
	dataBuff.writeBinary(protoRspServerRegist.serializeBinary().buffer);
	dataBuff.writeEnd(protoCMD.RSPSERVERREGIST);
	let sendData = dataBuff.dataBuffer;
	handler.send(sendData);

	logger.info('onServerRegist end');
};

Gateway.prototype.onClientEnterGameServer = function(handler, messageBuff, srcId) {
	logger.info('onClientEnterGameServer start');
	let ack = new protoMsg.CProtoNotifyBridgeGameServer.deserializeBinary(messageBuff);
	if (!ack) {
		logger.error('deserializeBinary failed');
		return;
	}

	for (let eachMid of ack.getMidListList()) {
		this.clientsToGame.set(eachMid, srcId);
		logger.info('clientsToGame insert mid =', eachMid, ',sever_id =', srcId);
	}
	logger.info('onClientEnterGameServer end');
};

Gateway.prototype.onClientLeaveGameServer = function(handler, messageBuff, srcId) {
	logger.info('onClientLeaveGameServer start');
	let ack = new protoMsg.CProtoNotifyBridgeGameServer.deserializeBinary(messageBuff);
	if(!ack) {
		logger.info('deserializeBinary failed');
		return;
	}
	for(let eachMid of ack.getMidListList()) {
		this.clientsToGame.delete(eachMid);
	}
	logger.info('onClientLeaveGameServer end');
};


Gateway.prototype.OnServerConnect = function(){
	logger.info("OnServerConnect");
};

Gateway.prototype.OnServerMessage = function(handler, data){
	//logger.info('OnServerMessage');
	let recvDataBuff = new dataBuffer(data);
	//logger.info(recvDataBuff.dataBuffer);
	let headBuff = recvDataBuff.readBinary().buffer;
	let messageBuff = recvDataBuff.readBinary().buffer;
	let headProto = new protoCommon.head.deserializeBinary(headBuff);
	if (headProto == undefined || headProto == null) {
		logger.error('head parse failed');
		return;
	}
	let cmd = recvDataBuff.cmd();
	let dst = headProto.getDst();
	let dstType = dst.getType();
	let srcType = headProto.getSrc().getType();
	let srcId = headProto.getSrc().getId();
	if (dstType == 1 || dstType == 2 || dstType == 3) {
		logger.info(data);
		logger.info('OnServerMessage');
		logger.info('data length =', data.length);
		logger.info('OnServerMessage server cmd =', cmd);
		logger.info('OnServerMessage srcType =', srcType);
		logger.info('OnServerMessage dstType =', dstType);
	}
	if (dstType == protoCommon.end_point.EMEPTYPE_GATEWAY) {
		logger.info('gateway');
		switch (cmd){
		case protoCMD.REQSERVERREGIST:
			this.onServerRegist(handler, srcType, srcId, messageBuff);
			break;
		case protoCMD.NOTIFYENTERGAMESERVER:
			this.onClientEnterGameServer(handler, messageBuff, srcId);
			break;
		case protoCMD.NOTIFYLEAVEGAMESERVER:
			this.onClientLeaveGameServer(handler, messageBuff, srcId);
			break;
		default:
			logger.error('unknown msg to gateway, cmd =', cmd);
			break;
		}
	} else if (dstType == protoCommon.end_point.EMEPTYPE_CLIENT) {
		logger.info('client');
		let msgBuff = new dataBuffer();
		msgBuff.write(messageBuff);
		msgBuff.writeEnd(cmd);
		let sendData = msgBuff.dataBuffer;
		logger.info('sendData = ', sendData);
		if (dst.getIsBroad()) {
			this.broadMsgToClient(sendData);
		} else {
			for(let clientId of dst.getIdList()) {
				let clientHandler = this.getClientHandler(clientId);
				if(clientHandler) {
					logger.error('sendData length =', sendData.length);
					clientHandler.send(sendData);
				} else {
					logger.error('RROR,not find handler,type = ', dstType , ',id = ', clientId, ',cmd = ', cmd);
				}
			}
		}
	} else {
		if (dst.getIsBroad()) {
			for (let [eachServerId, eachServer] of this.servers) {
				//logger.info('server id =', eachServerId, "server type =", eachServer.type);
				if (eachServer.type == dst.getType()) {
					eachServer.send(data);
				}
			}
		} else {
			for (let eachServerId of dst.getIdList()) {
				logger.info('server id =', eachServerId);
				let serverHandler = this.getServerHandlerById(eachServerId);
				if (serverHandler) {
					serverHandler.send(data);
				} else {
					logger.error('ERROR, not find handler, type =', type, ",id = ", eachServerId);
				}
			}
		}
	}
};

Gateway.prototype.OnServerClose = function(handler){
	logger.info("OnServerClose start");
	this.gameCfg.delete(handler.guid);
	this.servers.delete(handler.guid);
	let clone = new Map(this.clientsToGame);
	for (let [eachMid, eachGameId] of clone) {
		if (eachGameId == handler.guid) {
			this.sendErrorToClient(this.getClientHandler(eachMid, protoMsg.error_code.ERROR_SERVER_CONNECTION_GONE,
				"game:" + handler.guid.toString()));
			this.clientsToGame.delete(eachGameId);
		}
	}

	logger.info("OnServerClose end");
};

Gateway.prototype.getClientHandler = function(mid) {
	return this.clients.get(mid);
};

Gateway.prototype.getDstGameId = function(mid) {
	let dstGameId = this.clientsToGame.get(mid);
	if (dstGameId == undefined) {
		return 0;
	}
	return dstGameId;
};

Gateway.prototype.getServerHandlerById = function(id) {
	logger.info('getServerHandlerById');
	return this.servers.get(id);
};

Gateway.prototype.getServerHandlerByType = function(type) {
	for (let [eachGameId, eachServer] of this.servers) {
		if (eachServer.type == type) {
			return eachServer;
		}
	}
	return null;
};

Gateway.prototype.getGameHandlerByRoomId = function(roomId, gameType) {
	if (this.gameCfg.length == 0) {
		return null;
	}

	for (let [eachServerId, eachCfg] of this.gameCfg) {
		if (roomId >= eachCfg.beginRoomId && roomId <= eachCfg.endRoomId &&
			(gameType == 0 || gameType > 0 && gameType == eachCfg.gameType)) {
			return this.getServerHandlerById(eachServerId);
		}

		if (gameType == 0 || gameType > 0 && gameType == eachCfg.gameType) {
			return this.getServerHandlerById(eachServerId);
		}
	}
	return this.getServerHandlerById(this.gameCfg.keys().next().value);
}

Gateway.prototype.getLastestHandler = function(gameType) {
	let maxTime = 0;
	let maxId = 0;
	for (let [eachGameId, eachCfg] of this.gameCfg) {
		logger.info('gameType =', gameType);
		if (eachCfg.gameType == gameType && eachCfg.startTime > maxTime) {
			logger.info('eachCfg gameType =', eachCfg.gameType, ' startTime =', eachCfg.startTime);
			maxTime = eachCfg.startTime;
			maxId = eachGameId;
		}
	}
	logger.info('maxId =', maxId);
	return this.getServerHandlerById(maxId);
};

Gateway.prototype.judgeServerHandler = function(cmd, handler, headMsg, dstHandlerArray) {
	logger.info('judgeServerHandler start');
	let routeType = headMsg.getRouteType();
	logger.info('routeType =', routeType, 'cmd =', cmd);
	logger.info('handler guid =', handler.guid);
	switch(routeType) {
	case protoMsg.CProtoClientHead.emRouteType.EMRT_COMMON:
		if (Gateway.CMDTYPE.emCMDTYPE_CLIENT_TO_MAHJONG == this.getCMDType(cmd) ||
			Gateway.CMDTYPE.emCMDTYPE_CLIENT_TO_POKER == this.getCMDType(cmd)) {
			logger.info('serverId =', this.getDstGameId(handler.guid));
			let gameServerHandlerCommon = this.getServerHandlerById(this.getDstGameId(handler.guid));
			if (gameServerHandlerCommon) {
				dstHandlerArray.push(gameServerHandlerCommon);
			}
		} else {
			let hallServerHnadlerCommon = this.getServerHandlerByType(protoCommon.end_point.EMEPTYPE_HALL);
			if (hallServerHnadlerCommon) {
				logger.info('find xHall server handler');
				dstHandlerArray.push(hallServerHnadlerCommon);	
			}
		}
		break;
	case protoMsg.CProtoClientHead.emRouteType.EMRT_BYROOMID:
		let gameServerHandlerRoomId = this.getGameHandlerByRoomId();
		dstHandlerArray.push(gameServerHandlerRoomId);
		break;
	case protoMsg.CProtoClientHead.emRouteType.EMRT_BYLATESTGAME:
		logger.info('protoMsg.CProtoClientHead.emRouteType.EMRT_BYLATESTGAME');
		let gameServerHandlerLatest = this.getLastestHandler(headMsg.getGameType());
		if(gameServerHandlerLatest) {
			logger.error('find the latest server');
			dstHandlerArray.push(gameServerHandlerLatest);
		}
		break;
	case protoMsg.CProtoClientHead.emRouteType.EMRT_BYGAMETYPE:
		logger.info('game type =', headMsg.getGameType());
		for (let [eachServerId, eachCfg] of this.gameCfg) {
			logger.info('each gameType =', eachCfg.gameType);
			if ((headMsg.getGameType() == 0)||(headMsg.getGameType() == eachCfg.gameType)) {
				logger.info('id =', eachCfg.id);
				let serverHandlerById = this.getServerHandlerById(eachCfg.id);
				if (serverHandlerById) {
					logger.info('find game type =', eachCfg.gameType);
					dstHandlerArray.push(serverHandlerById);
				}
			}
		}
		break;
	case protoMsg.CProtoClientHead.emRouteType.EMRT_BYALL:
		for (let [eachServerId, eachServer] of this.servers) {
			if (eachServer.type != protoCommon.end_point.EMEPTYPE_LOGGER) {
				dstHandlerArray.push(eachServer);
			}
		}
		break;
	default:
		logger.info('error routeType =', routeType);
	}
	logger.info('judgeServerHandler end');
};

Gateway.prototype.versionCompare = function(clientVersion) {
	//todo
};

Gateway.prototype.checkLoginToken = function(mid, time, token) {
	logger.info('checkLoginToken start');
	logger.info('mid =', mid, 'time =', time, 'token =', token);
	let key = 'zswepohftW45Dqwe12';
	let genString = mid.toString() + time.toString() + key;
	let genToken = md5(genString);
	let timeDiff = Math.floor(Date.now() / 1000)- time;
	if (Math.abs(timeDiff) > 15 * 24 * 3600) {
		return protoMsg.error_code.ERROR_TOKEN_EXPIRED;
	}

	if (genToken != token) {
		return protoMsg.error_code.ERROR_TOKEN_ERROR;
	}

	return protoMsg.error_code.ERROR_OK;
};

Gateway.prototype.broadMsgToClient = function(messageBuff) {
	for (let [eachMid, eachClient] of this.clients) {
		eachClient.send(messageBuff);
	}
};

Gateway.prototype.sendErrorToClient = function(handler, err, opt_errMsg) {
	let protoNotifyErrorCode = new protoMsg.CProtoNotifyErrorCode();
	if (!opt_errMsg) {
		for (let errMsg in protoMsg.error_code) {
			if (err == protoMsg.error_code[errMsg]) {
				protoNotifyErrorCode.setErr(err);
				protoNotifyErrorCode.setErrMsg(errMsg);
				break;
			}
		}
	} else {
		protoNotifyErrorCode.setErr(err);
		protoNotifyErrorCode.setErrMsg(opt_errMsg);
	}
	this.sendToClient(handler, protoCMD.NOTIFYERRORCODE, protoNotifyErrorCode);
	return;
};

Gateway.prototype.sendToServer = function(cmd,data, headMsg) {
	let dataBuff = new dataBuffer();
	dataBuff.writeBinary(headMsg.serializeBinary().buffer);
	if (data) {
		dataBuff.writeBinary(data);
	}
	dataBuff.writeEnd(cmd);
	let sendData = dataBuff.dataBuffer;

	let dst = headMsg.getDst();
	let count = 0;

	if (dst.getIsBroad()) {
		for (let [eachServerId, eachServer] of this.servers) {
			if (eachServer.type == dst.getType() || dst.getType() == 0) {
				eachServer.send(sendData);
				count++;
			}
		}
	} else {
		for (let eachId of dst.getIdList()) {
			let serverHandler = this.getServerHandlerById(eachId);
			if (serverHandler) {
				serverHandler.send(sendData);
				count++;
			} else {
				logger.error('error, not find hander type =', dst.getType(), ', id =', eachId);
			}
		}
	}
	return count;
};

Gateway.prototype.sendToClient = function(handler, cmd, message) {
	logger.info('sendToClient start');
	if (!handler) {
		logger.error('handler is null');
		return;
	}

	let dataBuff = new dataBuffer();
	if (message) {
		logger.info(message.toObject());
		dataBuff.write(message.serializeBinary().buffer);
	}
	dataBuff.writeEnd(cmd);
	let sendData = dataBuff.dataBuffer;
	//logger.error(sendData);
	handler.send(sendData);
	logger.info('sendToClient end');
}

Gateway.prototype.start = function() {
	logger.info(this.clientListenerCfg,this.serverListenerCfg);
	this.ClientListen();
	this.ServerListen();
};


module.exports = Gateway;