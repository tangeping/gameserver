var Mahjong = require('./lib/mahjong/mahjong.js');
var configMgr = require('./lib/conf/configmgr.js');

var cfg = configMgr.getInstance();

console.log(cfg.cfg);

var app = new Mahjong(cfg.cfg);

app.start();