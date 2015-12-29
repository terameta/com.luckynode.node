var db;
var Q				= require('q');
var mongojs 		= require('mongojs');
var moment			= require('moment');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');

module.exports = function(){
	var module = {
		list: list
	};
	return module;
};

function list(toReturn){
	console.log("ToReturn<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
	console.log("ToReturn:\n",toReturn);
	console.log("ToReturn<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
	if(!toReturn) toReturn = {};
	var deferred = Q.defer();
	tools.runLocalCommand("virsh secret-list").
	then(function(result){
		return returner.prepare(result,'secret-list');
	}).
	then(function(result){
		
		toReturn.secretList = result;
		
		console.log("ToReturn<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
		console.log("ToReturn After:\n",toReturn);
		console.log("ToReturn<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
		
		deferred.resolve(toReturn);
	}).fail(deferred.reject);
	return deferred.promise;
}