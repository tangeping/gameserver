var fs = require('fs');

var jsonCfg = fs.readFileSync('./cfg.json');
var jsonData = JSON.parse(jsonCfg);
console.log(jsonData.attr.subattr);