var logger = require('../log/mahjong.js').logger("info");
var message = require('../gpb/game_client_pb.js');
var common  = require('../gpb/common_pb.js');
var roomInterface = require('./roominterface.js');
var table = require('./table.js');

var protoCMD = proto.proto.cmd;

var MajiangRoom = function(roomMgr) {
	roomInterface.call(this, roomMgr);
	this.players = new Map();
	this.table = new table(4);

	this.gameMax = 0;
	this.gameCount = 0;
	this.createMid = 0;
	this.pbPlayType = new message.CProtoPlayType();
	this.limitFree = false;

	this.gameState = 0;
	this.roomState = 0;
	this.dealer = 1;
	this.dismissStarter = 0;
}

MajiangRoom.prototype = new roomInterface();

MajiangRoom.prototype.init = function() {

};

MajiangRoom.prototype.onReqDismiss =function(player, messageBuff) {
	if(!player){
		return;
	}

	if(this.roomState == roomInterface.roomState.EMROOMSTATE_FINALREPORT){
		return;
	}

	if(this.roomState == roomInterface.roomState.EMROOMSTATE_WAIT &&
		player.seatNo != this.createMid){
		this.roomMgr.mahjong.kick(player, true);
		return;
	}

	if(this.dismissStarter > 0){
		logger.error("dismiss already started,roomid:", this.roomId << ",dismiss_starter_:", this.dismissStarter, 
			",mid:", player.seatNo);
		return;
	}

	this.dismissStarter = player.seatNo;
	let data = this.getSeatData(player.seatNo);
	data.dismissStatus = 1;

	if(this.roomState == roomInterface.roomState.EMROOMSTATE_WAIT &&
		player.seatNo == this.createMid){
		this.broadDismissStatus();//todo
		this.clearRoom(false);
	}
	else{
		this.broadDismissStatus();
		this.newTime(5 * 60 * 1000, roomTimerContext.DISMISS_VOTE_TIMER);
	}
};

MajiangRoom.prototype.onAckDismiss = function(player, messageBuff) {};

MajiangRoom.prototype.onChat = function(player, messageBuff) {};

MajiangRoom.prototype.onLocation = function(player, messageBuff) {
	let data = this.getSeatData(player.seatNo);
	let dataProto = new message.CProtoReqLocations.deserializeBinary(messageBuff);
	logger.info('location =', dataProto.toObject());
	data.location.longitude = dataProto.getLongitude();
	data.location.latitude = dataProto.getLatitude();
	logger.info('data.location =',data.location);
	let self = this;
	let protoRspLocations = new message.CProtoRspLocations();
	this.players.forEach(function(value, key, map){
		logger.info('player no =', value.seatNo);
		let tmpData = self.getSeatData(value.seatNo);
		let protoLocationInfo = new message.CProtoRspLocations.locationInfo();
		protoLocationInfo.setSeatId(key - 1);
		protoLocationInfo.setLongitude(tmpData.location.longitude);
		protoLocationInfo.setLatitude(tmpData.location.latitude);
		protoRspLocations.addLocations(protoLocationInfo);
	});

	this.broadMessage(protoCMD.RSPLOCATIONS, protoRspLocations);
};


MajiangRoom.prototype.onReady = function(player, messageBuff) {
	if(this.gameState != roomInterface.gameState.WAITING &&
		this.gameState != roomInterface.gameState.FREEZING){
		logger.info('gameState =', this.gameState);
		return;
	}

	let dataProto = new message.CProtoReqReady.deserializeBinary(messageBuff);
	let data = this.getSeatData(player.seatNo);
	if(data.ready == (dataProto.getMReady() == 1 ? true : false)) {
		logger.debug('ready set to', data.ready);
		return;
	}
	data.ready = (dataProto.getMReady() == 1 ? true : false);

	let protoRspReady = new message.CProtoRspReady();
	protoRspReady.setMPos(player.seatNo - 1);
	protoRspReady.setMReady(data.ready);
	this.broadMessage(protoCMD.RSPREADY, protoRspReady);

	logger.info('mid =', player.uid, ', ready = ',data.ready);

	let self = this;
	let readyCount = 0;
	this.players.forEach(function(value, key, map) {
		let tmpData = self.getSeatData(value.seatNo);
		if(tmpData.ready){
			readyCount++;
		}
	});

	if(readyCount == this.table.size) {
		this.startNewGame();
	}
};

MajiangRoom.prototype.onDaPai = function(player, messageBuff) {};

MajiangRoom.prototype.onMakeDecision = function(player, messageBuff) {};

MajiangRoom.prototype.onBaoJiao = function(player, messageBuff) {};

MajiangRoom.prototype.onRoomMessage = function(player, cmd, messageBuff) {
	switch(cmd){
	case protoCMD.REQDISMISSROOM:
		this.onReqDismiss(player, messageBuff);
		break;
	case protoCMD.REQACKDISMISS:
		this.onAckDismiss(player, messageBuff);
		break;
	case protoCMD.REQCHATMSG:
		this.onChat(player, messageBuff);
		break;
	case protoCMD.REQLOCATIONS:
		this.onLocation(player, messageBuff);
		break;

	case protoCMD.REQREADY:
		this.onReady(player, messageBuff);
		break;
	case protoCMD.REQSHOWTILE:
		this.onDaPai(player, messageBuff);
		break;
	case protoCMD.REQPLAYERDECISION:
		this.onMakeDecision(player, messageBuff);
		break;
	case protoCMD.REQBAOJIAOOPT:
		this.onBaoJiao(player, messageBuff);
		break;
	default:
		logger.error("unknown cmd =", cmd);
		return -1;
	}
	return 0;
};

MajiangRoom.prototype.createRoom = function(robotCount, limitFree, pbPlayType) {
	this.lastUseTime = Math.floor(Date.now() / 1000);
	this.limitFree = limitFree;
	this.pbPlayType = pbPlayType;

	this.gameMax = this.pbPlayType.getMComm().getMRoundcount();

};

MajiangRoom.prototype.enter = function(player) {
	let err = 0;
	let reallyEnter = false;

	//如果是断线重连，就跳过去了
	if(!this.players.has(player.uid)) {
		player.roomObject = this;
		this.players.set(player.uid, player);

		let canSeatNo = 0;
		this.table.seats.forEach(function(value, key, map) {
			logger.info('seat no =', value.no, 'seat player', value.data.player);
			if(0 == canSeatNo){
				if(!value.data.player){
					canSeatNo = value.no;
				}
			}
		});

		logger.info('canSeatNo = ', canSeatNo);

		let data = this.getSeatData(canSeatNo);
		data.netStat = true;
		data.player = player;
		data.kickOut = false;
		data.sitDownTime = Math.floor(Date.now() / 1000);
		player.sitDown(canSeatNo);

		reallyEnter = true;
	}

	let protoRspJoinRoom = new message.CProtoRspJoinRoom();
	protoRspJoinRoom.setMErrorcode(err);
	player.sendTo(protoCMD.RSPJOINROOM, protoRspJoinRoom);

	this.notifyPlayerEnter(player);
	this.sendOthersInfoToMe(player);

	if(reallyEnter){
		this.broadCastMeEnter(player);
	}

	this.tableSnapShot(player, protoCMD.NOTIFYROOMSTATE);

	this.onReConnect(player);

	return err;
};


MajiangRoom.prototype.notifyPlayerEnter = function(player) {
	let msg = new message.CProtoNotifyEnterRoom();
	msg.setMState(3);
	msg.setMDeskid(this.roomId);
	let data = this.getSeatData(player.seatNo);
	logger.info('player seatNo = ', player.seatNo);
	logger.info('player data = ', data);
	msg.setMPos(player.seatNo - 1);
	msg.setMMaxcircle(this.gameMax);
	msg.setMReady(data.ready ? 1 : 0);
	msg.setMScore(data.finalScore);
	msg.setMCreater(this.createMid);
	msg.setMPlaytype(this.pbPlayType);

	player.sendTo(protoCMD.NOTIFYENTERROOM, msg);
};

MajiangRoom.prototype.sendOthersInfoToMe  = function(player) {
	let self = this;
	this.players.forEach(function(value, key, map){
		if(value.uid != player.uid){
			logger.info('value uid =', value.uid);
			self.snapShotSend(value, player);
		}
	});
};

MajiangRoom.prototype.broadCastMeEnter = function(player) {
	logger.info('broadCastMeEnter start');
	let self = this;
	this.players.forEach(function(value, key, map) {
		if(value.uid != player.uid){
			self.snapShotSend(player, value);
		}
	});
	logger.info('broadCastMeEnter end');
};

MajiangRoom.prototype.tableSnapShot = function(player, cmd) {
	logger.info('tableSnapShot start');
	let protoNotifyRoomState = new message.CProtoNotifyRoomState();
	this.PackTableProto(player, protoNotifyRoomState);
	player.sendTo(cmd, protoNotifyRoomState);
	logger.info('tableSnapShot end');
};

MajiangRoom.prototype.onReConnect = function(player) {
	logger.info('onReConnect start');
	let data = this.getSeatData(player.seatNo);
	data.netStat = true;
	this.broadNetStat(player);
	logger.info('onReConnect end');
};


MajiangRoom.prototype.PackTableProto = function(player, msg) {
	let data = this.getSeatData(player.seatNo);
	msg.setMState(1);
	msg.setMRoomState(0);
	msg.setMPos(player.seatNo - 1);
	msg.setMDcount(52);
	msg.setMZhuang(this.dealer - 1);
	msg.setMBasescore(this.pbPlayType.getMComm().getMBasescore());
};

MajiangRoom.prototype.snapShotSend = function(other, player) {
	let data = this.getSeatData(other.seatNo);
	logger.info('other seatNo =', other.seatNo);
	logger.info('other loginData', other.loginData.toObject());
	let msg = new message.CProtoNotifyAddPlayer();
	msg.setMUserid(other.uid);
	msg.setMNike(other.loginData.getNickname());
	msg.setMFace(other.loginData.getImgUrl());
	msg.setMSex(other.loginData.getGender());
	msg.setMIp(other.loginData.getIp());
	msg.setMPos(other.seatNo - 1);
	msg.setMReady(data.ready ? 1 : 0);
	msg.setMScore(data.finalScore);

	player.sendTo(protoCMD.NOTIFYADDPLAYER, msg);
};

MajiangRoom.prototype.broadNetStat = function(player) {
	let data  = this.getSeatData(player.seatNo);
	let msg = new message.CProtoNotifyOffLineState();
	msg.setMFlag(data.netStat);
	msg.setMIp(player.loginData.getIp());
	msg.setMPos(player.seatNo - 1);

	this.broadMessage(protoCMD.NOTIFYOFFLINESTATE, msg, player);
};

MajiangRoom.prototype.getSeatData = function(seatNo) {
	let seatData = null;
	this.table.seats.forEach(function(value, key, map) {
		if(key == seatNo){
			seatData = value.data;
		}
	});

	return seatData;
};

MajiangRoom.prototype.broadMessage = function(cmd, msg, opt_exclude) {
	this.players.forEach(function(value, key, map) {
		if(!opt_exclude || value != opt_exclude) {
			value.sendTo(cmd, msg);
		}
	});
}

MajiangRoom.prototype.startNewGame = function() {
	logger.info('startNewGame start');
};

MajiangRoom.prototype.leave_ = function(player) {
	logger.info('leave_ start');
	if(!player){
		logger.error('player is null');
		return -1;
	}

	if(!this.players.has(player.uid)){
		logger.error('player no such uid =', player.seatNo);
		return -1;
	}

	let data = this.getSeatData(player.seatNo);
	data.player = null;
	data.ready = false;
	data.netStat = false;
	data.kickOut = false;
	data.sitDownTime = 0;

	let protoNotifyRemovePlayer = new message.CProtoNotifyRemovePlayer();
	protoNotifyRemovePlayer.setMPos(player.seatNo - 1);
	this.broadMessage(protoCMD.NOTIFYREMOVEPLAYER, protoNotifyRemovePlayer, player);

	player.sitUp();

	player.roomObject = null;
	logger.info('before this.player.size =', this.players.size);
	logger.info('player.uid =', player.uid);
	this.players.delete(player.uid);
	logger.info('after this.player.size =', this.players.size)
	logger.info('leave_ end')
	return 0;
};

MajiangRoom.prototype.leave = function(player){
	logger.info('leave start')
	let err = this.leave_(player);
	logger.info('leave end err =', err);
	return err;
};


module.exports = MajiangRoom;