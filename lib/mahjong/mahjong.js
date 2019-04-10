var logger = require('../log/mahjong.js').logger("info");
var net = require('net');
var gwConnector = require('./gwconnector.js');
var message = require('../gpb/game_client_pb.js');
var common  = require('../gpb/common_pb.js');
var dataBuffer = require('./databuffer.js');
var roomInterface = require('./roominterface.js');
var roomMgr = require('./roommgr.js');

var playerClass = require('./player.js').Player;
var robotClass = require('./player.js').Robot;

var configMgr = require('../conf/configmgr.js');
var protoCMD = proto.proto.cmd;

var Mahjong = function(config) {
	this.players = new Map();
	this.roomMgr = new roomMgr(this);

	this.serverId = 4;
	this.serverType = proto.common.end_point.EMEPTYPE_GAMESERVER;
	this.gwConnector = new gwConnector(this.serverId, this.serverType, config, this);
};

module.exports = Mahjong;

Mahjong.prototype.onRspLogin = function(mid, messageBuff) {
	logger.info('onRspLogin');
	let hasGame = false;
	let player = this.players.get(mid);

	if(player && player.roomObject) {
		player.roomObject.enter(player);
	}
};

Mahjong.prototype.onCreateRoom = function(mid, messageBuff) {
	logger.info('onCreateRoom');
	let protoReqCreateCsRoom = new message.CProtoReqCreateCsRoom.deserializeBinary(messageBuff);
	let protoRspCreateCsRoom = new message.CProtoRspCreateCsRoom();
	//todo: 服务器已更新


	let playType = protoReqCreateCsRoom.getMPlaytype().getMComm();
	let roundCount = playType.getMRoundcount();
	let roomType = playType.getMGameid();
	let robotCount = protoReqCreateCsRoom.getMRobotnum();

	let room = this.roomMgr.allocEmptyRoom(mid, 3, 10);

	room.createRoom(robotCount, /*limitFree*/ false, protoReqCreateCsRoom.getMPlaytype());

	protoRspCreateCsRoom.setMErrorcode(0);
	protoRspCreateCsRoom.setRoomId(room.roomId);

	this.gwConnector.sendToClient(mid, protoCMD.RSPCREATECSROOM, protoRspCreateCsRoom);

	if(!playType.getCreateForOther()) {
		logger.info('send NOTIFYENTERGAMESERVER');
		this.notifyGatewayClientBridgeGameServer(protoCMD.NOTIFYENTERGAMESERVER, mid);
	}

	let error = {err:0};

	let newPlayer = this.newPlayerByMid(mid, error);
	room.enter(newPlayer);
};

Mahjong.prototype.onEnterRoom = function(mid, messageBuff) {
	logger.info('onEnterRoom start');
	let protoRspJoinRoom = new message.CProtoRspJoinRoom();
	let dataProto = new message.CProtoReqJoinRoom.deserializeBinary(messageBuff);
	let roomId = dataProto.getDeskId();
	logger.info('enter roomId =', roomId);
	let room = this.roomMgr.getRoomObject(roomId);
	if(!room){
		protoRspJoinRoom.setMErrorcode(proto.proto.error_code.ERROR_ROOM_NOT_EXIST);
		this.gwConnector.sendToClient(mid, protoCMD.RSPJOINROOM, protoRspJoinRoom);
		return 0;
	}
	let error = {err:0};
	let player = this.newPlayerByMid(mid,error);
	if(!player){
		protoRspJoinRoom.setMErrorcode(error.err);
		this.gwConnector.sendToClient(mid, protoCMD.RSPJOINROOM, protoRspJoinRoom);
		return 0;
	}
	if(player.roomObject && player.roomObject.roomId != roomId){
		protoRspJoinRoom.setMErrorcode(proto.proto.error_code.ERROR_STILL_IN_GAME);
		player.sendTo(protoCMD.RSPJOINROOM, protoRspJoinRoom);
		return 0;
	}

	/*todo 房卡检查
	....
	*/

	if( 0 == room.enter(player)) {
		this.notifyGatewayClientBridgeGameServer(protoCMD.NOTIFYENTERGAMESERVER, mid);
	}
	else{
		logger.info('onEnterRoom error');
	}

	logger.info('onEnterRoom end');
};

Mahjong.prototype.onLeaveRoom = function(mid, messageBuff) {
	logger.info('onLeaveRoom start');
	let player = this.getPlayer(mid);
	if(!player){
		logger.error('player is null, mid:', mid);
		return;
	}
	this.leaveRoom(player, true);
	logger.info('onLeaveRoom end');
};

Mahjong.prototype.onGetRoomList = function(mid, messageBuff) {
	logger.info('onGetRoomList start');
	let ids = this.roomMgr.getMyRooms(mid);
	if(!ids){
		return;
	}
	let myRoomsList = new Array();
	for(let id of ids){
		logger.info('my rooms id =', id);
		let room = this.roomMgr.getRoomObject(id);
		logger.info('room id =', room.roomId);
		if(room && room.roomState != roomInterface.roomState.EMROOMSTATE_FINALREPORT){
			myRoomsList.push(room);
		}
	}
	logger.info('myRoomList size =', myRoomsList.length);
	myRoomsList.sort((roomA, roomB) => roomB.lastUseTime - roomA.lastUseTime);

	let protoRspMyRoomList = new message.CProtoRspMyRoomList();
	for(let eachRoom of myRoomsList){
		let protoItem = new message.CProtoRspMyRoomList.CProtoItem();
		logger.info('eachRoom id =', eachRoom.roomId);
		protoItem.setRoomid(eachRoom.roomId);
		protoItem.setCurrPlayerCount(eachRoom.players.size);
		protoItem.setMPlaytype(eachRoom.pbPlayType);
		protoRspMyRoomList.addItems(protoItem);
	}

	protoRspMyRoomList.setPlayerRoomMax(10);

	this.gwConnector.sendToClient(mid, protoCMD.RSPMYROOMLIST, protoRspMyRoomList);

	logger.info('onGetRoomList end');
};

Mahjong.prototype.onConnectClose = function(mid, messageBuff) {
	logger.info('onConnectClose');
};

Mahjong.prototype.onGmQueryRoom = function(mid, messageBuff) {
	logger.info('onGmQueryRoom');
};

Mahjong.prototype.onGmDismissRoom = function(mid, messageBuff) {
	logger.info('onGmDismissRoom');
}

Mahjong.prototype.onServerRegist = function(mid, messageBuff) {
	logger.info('onRspServerRegist');
	let messageProto = new message.CProtoRspServerRegist.deserializeBinary(messageBuff);
	let err = messageProto.getErr();
	if(err != 0){
		//todo doShutDown();
		return;
	}

	//todo setServerStatus(emSS_Normal);
	let midArray = [];
	let self = this;

	this.players.forEach(function(value, key, map) {
		midArray.push(value.uid);
		if(midArray.length > 500) {
			self.notifyGatewayClientBridgeGameServer(protoCMD.NOTIFYENTERGAMESERVER, midArray);
			midArray = [];
		}
	});

	if(midArray.length <= 500) {
		self.notifyGatewayClientBridgeGameServer(protoCMD.NOTIFYENTERGAMESERVER, midArray);
	}

	//some todo

};

Mahjong.prototype.onGmCmd = function(mid, messageBuff) {
	logger.info('onGmCmd');
};

Mahjong.prototype.onGameConfig = function(mid, messageBuff) {
	logger.info('onGameConfig');
	let cCfg = configMgr.getInstance().cCfg;
	let ack = new message.CProtoRspGameConfig();
	ack.setGameId(3);
	ack.setPlayerRoomMax(1000);
	for(let eachCost of cCfg.cardCost) {
		let cardItem = new message.CProtoRspGameConfig.CProtoCardItem();
		cardItem.setGameMax(eachCost.game_max);
		cardItem.setAaPay(eachCost.aa_pay);
		cardItem.setCreaterPay2(eachCost.creater_pay_2);
		cardItem.setCreaterPay3(eachCost.creater_pay_3);
		cardItem.setCreaterPay4(eachCost.creater_pay_4);
		ack.addCardItems(cardItem);
	}

	logger.info('onGameConfig mid =', mid);
	this.gwConnector.sendToClient(mid, protoCMD.RSPGAMECONFIG, ack);
};

Mahjong.prototype.onLimitFree = function(mid, messageBuff) {
	logger.info('onLimitFree');
};

Mahjong.prototype.onRoomMessage = function(cmd, player, messageBuff) {
	logger.info('onRoomMessage');

	if(!player){
		logger.error('player == null,cmd =', cmd);
		return;
	}
	if(!player.roomObject) {
		logger.error('player.getRoomObject() == null,cmd =', cmd);
		return;
	}
	player.roomObject.onRoomMessage(player, cmd, messageBuff);
};

Mahjong.prototype.onMessage = function(data) {
	let recvDataBuff = new dataBuffer(data.buffer);
	let cmd = recvDataBuff.cmd();
	logger.info('cmd = ', cmd);
	let headBuff = recvDataBuff.readBinary();
	let headProto = new proto.common.head.deserializeBinary(headBuff);
	let src_type = headProto.getSrc().getType();
	let mid = headProto.getSrc().getId();
	logger.info('mid = ', mid);
	let messageBuff = recvDataBuff.readBinary();
	switch(cmd) {
		case protoCMD.RSPLOGIN:
			this.onRspLogin(mid, messageBuff);
			break;
		case protoCMD.REQCREATECSROOM:
			this.onCreateRoom(mid, messageBuff);
			break;
		case protoCMD.REQJOINROOM:
			this.onEnterRoom(mid, messageBuff);
			break;
		case protoCMD.REQQUITROOM:
			this.onLeaveRoom(mid, messageBuff);
			break;
		case protoCMD.REQMYROOMLIST:
			this.onGetRoomList(mid, messageBuff);
			break;
		case protoCMD.NOTIFYCLIENTCLOSED:
			this.onConnectClose(mid, messageBuff);
			break;
		case protoCMD.REQQUERYROOM:
			this.onGmQueryRoom(mid, messageBuff);
			break;
		case protoCMD.REQGMDISMISSROOM:
			this.onGmDismissRoom(mid, messageBuff);
			break;
		case protoCMD.RSPSERVERREGIST:
			this.onServerRegist(mid, messageBuff);
			break;
		case protoCMD.REQGMCMD:
			this.onGmCmd(mid, messageBuff);
			break;
		case protoCMD.REQGAMECONFIG:
			this.onGameConfig(mid, messageBuff);
			break;
		case protoCMD.REQLIMITFREE:
			this.onLimitFree(mid, messageBuff);
			break;
		default: {
			logger.info('onMessage default');
			let player = this.getPlayer(mid);
			if(player) {
				logger.info('player this.onRoomMessage');
				this.onRoomMessage(cmd, player, messageBuff);
			}
			break;
		}
	}

};

Mahjong.prototype.getPlayer = function(mid) {
	logger.info('getPlayer');
	let player = this.players.get(mid);
	if(!player) {
		logger.info('player is null');
		return null;
	}
	logger.info('return player');
	return player;
};

Mahjong.prototype.newPlayerByMid = function(mid, error) {
	error.err = 0;
	let player = this.getPlayer(mid);
	if(!player) {
		player = new playerClass(mid);
		player.setGwConnector(this.gwConnector);
	}

	if(!player) {
		logger.info('CreateRealPlayer failed');
		error.err = proto.proto.error_code.ERROR_SERVER_ERROR;
		return null;
	}
	logger.info('err = ', error.err);
	error.err = player.serialize(true);
	if(error.err != 0){
		logger.info('err != 0, reutnr null');
		return null;
	}
	logger.info('err = ', error.err);
	this.players.set(mid, player);

	return player;
};

Mahjong.prototype.notifyGatewayClientBridgeGameServer= function(cmd, mid) {
	logger.info('notifyGatewayClientBridgeGameServer start');
	let protoHead = new common.head();
	let protoHeadSrc = new common.head.src_type();
	let protoHeadDst = new common.head.dst_type();
	protoHeadSrc.setType(proto.common.end_point.EMEPTYPE_GAMESERVER);
	protoHeadSrc.setId(this.serverId);
	protoHead.setSrc(protoHeadSrc);
	protoHeadDst.setType(proto.common.end_point.EMEPTYPE_GATEWAY);
	protoHeadDst.addId(0);
	protoHead.setDst(protoHeadDst);
	let dataBuff = new dataBuffer();
	dataBuff.writeBinary(protoHead.serializeBinary().buffer);
	let protoNotifyBridgeGameServer = new message.CProtoNotifyBridgeGameServer();
	if(mid instanceof Array) {
		protoNotifyBridgeGameServer.setMidListList(mid);
	} else {
		protoNotifyBridgeGameServer.addMidList(mid);
	}
	dataBuff.writeBinary(protoNotifyBridgeGameServer.serializeBinary().buffer);
	dataBuff.writeEnd(cmd);
	let sendData = Buffer.from(dataBuff.dataBuffer);
	this.gwConnector.gateway.write(sendData);
	logger.info('notifyGatewayClientBridgeGameServer end');
};

Mahjong.prototype.removePlayer = function(player) {
	logger.info('removePlayer start');
	this.notifyGatewayClientBridgeGameServer(protoCMD.NOTIFYLEAVEGAMESERVER, player.uid);

	player.serialize(false);

	if(!player.isRobot()){
		this.players.delete(player.seatNo);
	}
	player = null;
	logger.info('removePlayer end');
};

Mahjong.prototype.leaveRoom = function(player, notify){
	logger.info('leaveRoom start');
	let room = player.roomObject;
	let err = 0;
	if(room){
		err = room.leave(player);
		if(notify){
			let protoRspQuitRoom = new message.CProtoRspQuitRoom();
			protoRspQuitRoom.setMErrorcode(err);
			player.sendTo(protoCMD.RSPQUITROOM, protoRspQuitRoom);
		}
	}

	if(!player.roomObject){
		if(player.isRobot()){
			player = null;
		}
		else
		{
			this.removePlayer(player);
		}
	}
	logger.info('leaveRoom end');
};

Mahjong.prototype.start = function() {
	this.gwConnector.connectGateWay();
};

