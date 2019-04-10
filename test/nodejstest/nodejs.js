function Human(firstName, lastName) {
	this.firstName = firstName;
	this.lastName  = lastName;
	this.fullName = function() {
		console.log(this.firstName," ",this.this.lastName);
	}
};

Human.prototype.Name = function() {
	console.log(this.firstName);
}

Human.prototype.CONST = 'const';

Human.CLASS_CONST = 'class const';

Human.Hello = function() {
	console.log('hello');
}

var Person = function(firstName, lastName){
	Human.call(this,firstName, lastName);
};

Human.prototype.Name = function() {
	console.log(this.lastName);
	console.log('Human class_const = ', Human.CLASS_CONST);
};

Person.prototype = new Human();

Person.prototype.Name = function() {
	console.log(this.lastName);
	console.log('Person class_const = ', Human.CLASS_CONST);
};

var p = new Person('tom','smit');
p.Name();

module.exports = Person;

// var clonePerson = Object.assign(new Person(), p);
// p.Name();
// clonePerson.Name();
// clonePerson.lastName = 'oiioo';
// p.lastName = 'asdfasd';
// p.Name();
// clonePerson.Name();

// var myMap = new Map();

// var firstSet = new Set();
// firstSet.add(11);
// firstSet.add(12);
// firstSet.add(13);
// myMap.set(1, new Set(firstSet));

// //var secondSet = new Set();
// firstSet.add(21);
// firstSet.add(22);
// firstSet.add(23);
// myMap.set(2, firstSet);

// console.log(myMap);

// var isHave = false;

// myMap.forEach(function(value, key, map){
// 	console.log(key);
// 	if(key == 1){
// 		console.log('first value = ', value.values().next().value);
// 		value.add(14);
// 		isHave = true;
// 	}
// });

// console.log(isHave);
// // console.log(myMap);

// var myObj = {};

// if(!myObj){
// 	console.log('myObj is null');
// }

// var uid = 123456;

// var myString = 'Select * from `user` where `id`=' + uid;
// console.log(myString);
