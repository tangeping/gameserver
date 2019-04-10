var logger = require('../../lib/log/mahjong.js').logger("info");
var net = require('net');
var message = require('../../lib/gpb/game_client_pb.js');
var common  = require('../../lib/gpb/common_pb.js');
var dataBuffer = require('../../lib/mahjong/databuffer.js');
var player = require('../../lib/mahjong/player.js').Player;
var robot = require('../../lib/mahjong/player.js').Robot;

var realPlayer = new player();

logger.info(realPlayer.type);