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
	if(!toReturn) toReturn = {};
	var deferred = Q.defer();
	tools.runLocalCommand("virsh secret-list").
	then(function(result){
		return returner.prepare(result,'secret-list');
	}).
	then(function(result){
		console.log("SecretList<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
		console.log("Returner Result:\n",result);
		console.log("SecretList<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
		toReturn.secretList = result;
		deferred.resolve(toReturn);
	}).fail(deferred.reject);
	return deferred.promise;
}