var player = require('./player.js').Player;
var robot  = require('./player.js').Robot;


var SeatData = function() {
	this.sitDownTime = 0;
	this.player = null;

	this.ready = false;
	this.netStat = false;
	
	this.finalScore = 0;

	this.dismissStatus = 0;

	this.kickOut = false;
	this.location = {longitude:null,latitude:null};
};

var Seat = function(seatNo) {
	this.no = seatNo || 0;
	this.visiable = true;
	this.data = new SeatData();
};

module.exports = Seat;
