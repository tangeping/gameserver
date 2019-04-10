var seat = require('./seat.js');

var Table = function (seatSize) {
	this.seats = new Map();
	this.init(seatSize);
};

module.exports = Table;

Table.prototype.init = function(seatSize) {
	for(var i = 1; i <= seatSize; i++) {
		this.seats.set(i, new seat(i));
	}
};

Table.prototype.reset = function(seatsCount) {
	this.seats.forEach(function(value, key, map) {
		if(key > seatsCount) {
			value.visiable = false;
		}
	});
};