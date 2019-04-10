// function change(value){
// 	value.num = 2;
// }

// var myValue = {num:100};
// console.log('before myValue =', myValue);
// change(myValue);
// console.log('after myValue =', myValue);

// var num = 213;
// console.log(num);
// if(num instanceof Number) {
// 	console.log('Number');
// } else if (num instanceof Array) {
// 	console.log('Array');
// }

// var myMap = new Map();
// //var mySet = new Set();
// //mySet.add(234);
// myMap.set(1, (new Set).add(1234));
// console.log(myMap);

// let tmpValue = myMap.get(1);
// tmpValue.add(4856);

// console.log(myMap);
// var Number = function(number){
// 	this.number = number;
// };

// var my = new Array();
// my.push(new Number(3));
// my.push(new Number(1));
// my.push(new Number(2));

// console.log(my);

// //mySet.sort();
// console.log(my.sort((numA, numB) => numB.number - numA.number)); 

// for(let num of my){
// 	console.log(num.number);
// }
// var person = require('./nodejs.js');

// var p = person('ch','li');
// p.Name();

// var my = new Map();
// my[2] = 2;
// console.log(my);

// var cmd = {
// 	first:1,
// 	second:2,
// 	third:3
// }

// for(let name in cmd) {
// 	console.log(name);
// 	if(name == 'second'){
// 		console.log(cmd[name]);
// 		return;
// 	}
// }


// var buff = new Buffer.alloc(0);
// console.log(buff.length);
// console.log(buff.buffer.byteLength)



// if(null) {
// 	console.log('undefined');
// } else {
// 	console.log('print');
// }

// var myMap = new Map();

// myMap[1] = 11;
// myMap[2] = 22;
// myMap[3] = 33;

// myMap.set(4, 44);
// myMap.set(5, 55);
// myMap.set(6, 66);

// console.log(myMap);

// myMap.forEach(function(value, key, map) {
// 	if(key == 5) {
// 		return;
// 	}
// 	console.log(key);
// });

// for(let each of myMap) {
// 	if(each[0] == 5){
// 		continue;
// 	}
// 	console.log(each[1]);
// }

// var ob = function(){
// 	this.o = 34;
// 	this.b = 341;
// }

// var oobb = new ob();

// console.log(oobb);

// function changeValue(value) {
// 	value.value = 9080;
// }

// var myValue = {value:3124}
// console.log(myValue);
// changeValue(myValue);
// console.log(myValue);

//console.log(1 + undefined);
//console.log(1 + false);

var Duck = function(){
}

Duck.prototype.call = function() {
	console.log('duck call');
}

var Chicken = function () {
}

Chicken.prototype.call = function() {
	console.log('chicken call');
}

function animalCall(animal) {
	animal.call();
}

var d = new Duck();
var c = new Chicken();

animalCall(d);
animalCall(c);