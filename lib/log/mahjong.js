const log4js = require("log4js");
const log4js_extend = require('log4js-extend');

log4js.configure({
	appenders:{
		info:{
			type: 'console',
			filename: 'info.mahjong.log',
			pattern: 'yyyy-MM-dd.log',
			alwaysIncludePattern: true
		},
		debug:{
			type: 'console',
			filename: 'debug.mahjong.log',
			pattern: 'yyyy-MM-dd.log',
			alwaysIncludePattern: true
		},
		error:{
			type: 'console',
			filename: 'error.mahjong.log',
			pattern: 'yyyy-MM-dd.log',
			alwaysIncludePattern: true
		},
	},
	categories:{
		default:{
			appenders:['info'],
			level:'info'
		},
		info:{
			appenders:['info'],
			level:'info'
		},
		debug:{
			appenders:['debug'],
			level:'debug'
		},
		error:{
			appenders:['error'],
			level:'error'
		}
	}
});

log4js_extend(log4js,{
	format: "[at @name (@file:@line:@column)]"
});

exports.logger = function(name){
	var logger = log4js.getLogger(name);
	return logger;
}
