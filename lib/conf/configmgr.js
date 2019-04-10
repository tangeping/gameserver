var fs = require('fs');

var ConfigMgr = function(){
	this.cfg = null;
	this.cCfg = null;
	this.readCfg( __dirname + '/cfg.json');
	this.readCCfg(__dirname + '/c_cfg.json');
	this.instance = null;
};

ConfigMgr.prototype.readCfg = function (cfgPath) {
	console.log('cfgPath = ', cfgPath);
	this.cfg = JSON.parse(fs.readFileSync(cfgPath));
}

ConfigMgr.prototype.readCCfg = function (cfgPath) {
	console.log('c_cfgPath = ', cfgPath);
	this.cCfg = JSON.parse(fs.readFileSync(cfgPath));
}

// ConfigMgr.getInstance = (function(){
// 	var instance = null;
// 	return function(){
// 		if(!instance){
// 			instance = new ConfigMgr();
// 		}
// 		return instance;
// 	}
// })();

ConfigMgr.getInstance = function() {
	if(!this.instance) {
		this.instance = new ConfigMgr();
	}
	return this.instance;
}

module.exports.getInstance = ConfigMgr.getInstance;