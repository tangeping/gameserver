var DB = require('../db/dbmysql.js');
var message = require('../gpb/game_client_pb.js');

var login = new proto.proto.CProtoReqLogin();

login.setMid(100111);
login.setToken('dsfdsafds');
console.log(login.toString());

var reqLoginBuf = login.serializeBinary();
console.log(reqLoginBuf);
var reqLoginProto = new proto.proto.CProtoReqLogin.deserializeBinary(reqLoginBuf);
console.log(reqLoginProto.toString());

// var config = {
// 	host : '192.168.1.133',
// 	user : 'root',
// 	password : '112358return',
// 	port : '3306',
// 	database : 'enshimj'
// }

// var db_log = new DB(config);

// var sql = 'select * from `user` where `id`=100386;';

// db_log.Query(sql,function(result){
// 	console.log(result[0].Id)
// });

//db.Close();