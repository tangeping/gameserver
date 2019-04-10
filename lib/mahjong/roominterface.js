var RoomInterface = function(roomMgr) {
	this.roomId = 0;
	this.roomMgr = roomMgr;
	this.lastUseTime = 0;
};

module.exports = RoomInterface;

RoomInterface.gameState = {
	WAITING:0,
	PLAYING:1,
	FREEZING:2
};

RoomInterface.roomState = {
	EMROOMSTATE_WAIT:0,
	EMROOMSTATE_PLAYING:1,
	EMROOMSTATE_FINALREPORT:2
}

