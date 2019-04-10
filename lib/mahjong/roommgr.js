var logger = require('../log/mahjong.js').logger("info");
var message = require('../gpb/game_client_pb.js');
var common  = require('../gpb/common_pb.js');
var majiangRoom = require('./majiangroom.js');
var configMgr = require('../conf/configmgr.js');

var RoomMgr = function(mahjongApp) {
	this.mahjong = mahjongApp;
	this.createdRooms = new Map();
	this.rooms = new Map();
	this.roomsType = new Map();
	this.totalRoomCount = 0;
	this.initialize();
};

RoomMgr.prototype.initialize = function() {
	let cCfg = configMgr.getInstance().cCfg;
	let rooms = new Set();
	let type = 0;
	let roomCount = 0;
	for(let roomCfg of cCfg.systemRoomCfg){
		type = roomCfg.id;
		roomCount = roomCfg.count;
		logger.info('init type =', type, ' room count = ', roomCount);
		switch(type) {
		case proto.proto.emPlayType.EMPLAYTYPE_KAERTIAO: {
			while(roomCount--) {
				rooms.add(new majiangRoom(this.mahjong));
			}
			break;
		}
		case proto.proto.emPlayType.EMPLAYTYPE_KAXINWU: {
			//rooms.add(new majiangRoom(this.mahjong));
			logger.info('type =', type);
			break;
		}
		default:{
			logger.error('error type');
			break;
		}
		}
		this.roomsType.set(type, rooms);
	}
};

RoomMgr.prototype.getRoomObject = function(roomId){
	logger.info('rooms size =', this.rooms.size);
	return this.rooms.get(roomId);
};

RoomMgr.prototype.allocRoom = function(type) {
	logger.info('type = ', type);
	let findTypeRooms = this.roomsType.get(type);
	if(!findTypeRooms){
		return null;
	}
	if(0 == findTypeRooms.size){
		logger.error('size is 0');
		return null;
	}

	logger.info('before typerooms size =', findTypeRooms.size);
	let room = findTypeRooms.values().next().value;
	findTypeRooms.delete(room);
	logger.info('after typerooms size =', findTypeRooms.size);
	return room;
};

RoomMgr.prototype.allocEmptyRoom = function(mid, type, numLimit) {
	let room = this.allocRoom(type);

	if(!room) {
		return proto.proto.error_code.ERROR_SERVER_ERROR;
	}

	let id = this.getOneRoomId();
	room.roomId = id;
	this.rooms.set(id, room);

	let myCreateRooms = this.createdRooms.get(mid);
	if(!myCreateRooms) {
		this.createdRooms.set(mid,(new Set()).add(id));
	} else {
		myCreateRooms.add(id);
	}

	return room;
};

RoomMgr.prototype.freeRoom = function(room) {
	this.rooms.delete(room.roomId);
	room.roomId = 0;

	//todo
};

RoomMgr.prototype.removeFromMyRoomList = function(room) {
	//todo
};

RoomMgr.prototype.getMyRooms = function(mid) {
	return this.createdRooms.get(mid);
};

RoomMgr.prototype.getOneRoomId = function() {
	let id = 0;
	do{
		id = Math.floor(Math.random() * 899999 + 100000);
	}while(this.rooms.get(id));

	return id;
};

module.exports = RoomMgr;