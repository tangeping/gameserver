var logger = require('../log/mahjong.js').logger("info");
var net = require('net');
var message = require('../gpb/game_client_pb.js');
var common  = require('../gpb/common_pb.js');
var dataBuffer = require('./databuffer.js');
var db = require('./../db/dbmysql.js');

var protoCMD = proto.proto.cmd;

var PlayerInterface = function() {
	this.type = undefined;
	this.roomObject = null;
	this.gwConnector = null; 
};

PlayerInterface.Type = {
	ROBOT:1,
	REAL_PLAYER:2
}

PlayerInterface.prototype.setGwConnector = function(gwConnectorApp) {
	this.gwConnector = gwConnectorApp;
};

var Player = function(mid) {
	PlayerInterface.apply(this);
	this.type = PlayerInterface.Type.REAL_PLAYER;
	this.loginData = new message.CProtoLoginData();
	this.uid = mid;
	this.seatNo = undefined;

	this.connector = null;
	this.cardCount = 0;
	this.score = 0;
	this.sessionId = mid;
	this.isNew = false;
	this.userType = 0;
	this.lastShareTime = 0;
	this.black = false;
	this.currentServer = 0;
};

Player.prototype = new PlayerInterface();

Player.prototype.sitDown = function(seatNo) {
	this.seatNo = seatNo;
};

Player.prototype.sitUp = function() {
	this.seatNo = undefined;
};

Player.prototype.isRobot = function() {
	return this.type == PlayerInterface.ROBOT_TYPE;
};

Player.prototype.serialize = function(loadOrSave) {
	if(loadOrSave){
		return this.loadData();
	}

	return 0;
};

Player.prototype.loadData = function() {
	let sql = 'Select * from `user` where `id`=' + this.uid + ';';
	logger.info('sql =', sql);
	let dbMahjong = db.getInstance();
	let queryDataArray = dbMahjong.query(sql);
	let queryData = queryDataArray[0];
	logger.info(queryData);
	if(!queryData){
		return proto.proto.error_code.ERROR_LOAD_DATA_FAILED;
	}
	this.cardCount = queryData.NumsCard2;
	this.userType = queryData.user_type;
	this.black = (queryData.status == 1);
	this.lastShareTime = queryData.last_share;
	this.currentServer = queryData.current_server;

	this.loginData.setPlatform(queryData.platform);
	this.loginData.setDeviceId(queryData.device_id);
	this.loginData.setIp(queryData.login_ip);
	this.loginData.setGender(queryData.Sex);
	this.loginData.setNickname(queryData.Nike);
	this.loginData.setImgUrl(queryData.HeadImageUrl);
	this.loginData.setWxUnionid(queryData.UnionId);
	this.loginData.setMid(this.uid);

	logger.info('loginData =', this.loginData.toObject());
	return 0;
};

Player.prototype.sendTo = function(cmd, message) {
	logger.info('playe mid =', this.uid);
	this.gwConnector.sendToClient(this.uid, cmd, message);
};

Player.prototype.sendProto = function(msg) {
	//todo
}

var Robot = function() {
	Player.apply(this);
	this.type = PlayerInterface.Type.REAL_PLAYER.ROBOT_TYPE;
};


Robot.prototype = new Player();

Robot.prototype.onQiShouHu = function(message) {};

Robot.prototype.onNotifyOptions = function(message) {};

Robot.prototype.OnDaPai = function(message) {};

Robot.prototype.onReady = function(message) {};

Robot.prototype.onDismissRoom = function(message) {};

Robot.prototype.onOptAfterGang = function(message) {};

Robot.prototype.onBaoJiao = function(message) {};

Robot.prototype.onNotifyChooseCard = function(message) {};

Robot.prototype.onNotifyDingQue = function(message) {};

Robot.prototype.sendTo = function(cmd, message) {
	switch(cmd){
	case protoCMD.NOTIFYQISHOUHU:
		this.onQiShouHu(message);
		break;
	case protoCMD.RSPMAKEDECISIONCS:
		this.onNotifyOptions(message);
		break;
	case protoCMD.RSPMYTURNTOSHOW:
		this.OnDaPai(message);
		break;
	case protoCMD.NOTIFYROUNDREPORT:
	case protoCMD.NOTIFYENTERROOM:
		this.onReady(message);
		break;
	case protoCMD.RSPDISSMISSROOM:
		this.onDismissRoom(message);
		break;
	case protoCMD.RSPAFTERGANG:
		this.onOptAfterGang(message);
		break;
	case protoCMD.NOTIFYCANBAOJIAO:
		this.onBaoJiao(message);
		break;
	case protoCMD.NOTIFYSTARTCHOOSECARD:
		this.onNotifyChooseCard(message);
		break;
	case protoCMD.NOTIFYDINGQUE:
		this.onNotifyDingQue(message);
		break;
	default:
		logger.error('unknown cmd =', cmd);
		break;
	}
};

Robot.prototype.serialize = function(isLoad) {
	if(!isLoad){
		return 0;
	}
	let sql = 'Select * from `robot` where `mid`=' + this.uid + ';';
	logger.info('sql =', sql);
	let dbMahjong = db.getInstance();
	let queryDataArray = dbMahjong.query(sql);
	let queryData = queryDataArray[0];
	logger.info(queryData);
	if(!queryData){
		return proto.proto.error_code.ERROR_LOAD_DATA_FAILED;
	}

	this.loginData.setGender(queryData.sex);
	this.loginData.setNickname(queryData.name);
	this.loginData.setImgUrl(queryData.icon);
	//score ?
	return 0;
};

module.exports = {
	PlayerInterface,
	Player,
	Robot
};