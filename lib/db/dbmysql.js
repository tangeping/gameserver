var logger = require('../log/mahjong.js').logger("info");
var mysql = require('sync-mysql');

var DBMysql = function(config){
	this.db = new mysql({
		host : config.host,
		user : config.user,
		password : config.password,
		port : config.prot,
		database : config.database
	});
	// this.db.connect(function(err){
	// 	if(err){
	// 		logger.info('error connecting: ' + err.stack);
	// 		return;
	// 	}
	// });
}

// DBMysql.prototype.query = function(sql,cb){
// 	this.db.query(sql,function(err, result){
// 		if(err){
// 			logger.info("error");
// 			return;
// 		}
// 		cb(result);
// 	});
// 	this.db.end();
// }

DBMysql.prototype.query = function(sql) {
	return this.db.query(sql);
};

DBMysql.prototype.close = function(){
	//this.db.destroy();
}

DBMysql.getInstance = (function(){
	var db = null;
	var config = {
		host : '192.168.1.133',
		user : 'root',
		password : '112358return',
		port : '3306',
		database : 'kaertiao_mj'
	}
	return function(){
		if(!db){
			db = new DBMysql(config);
		}
		return db;
	};
})();

module.exports.getInstance = DBMysql.getInstance;