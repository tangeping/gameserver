var configMgr = require('./../../lib/conf/configmgr.js');

var cfg = configMgr.getInstance();
console.log(cfg.cCfg);

var cfg1 = configMgr.getInstance();

console.log(cfg === cfg1);

console.log(null == {});