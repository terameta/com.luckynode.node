var db;
var Q				= require('q');
var mongojs 		= require('mongojs');
var moment			= require('moment');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');

module.exports = function(refdb){
	db = refdb;
	var module = {
		list: list
	};
	return module;
};

function list(){
	var deferred = Q.defer();
	tools.runLocalCommand("virsh secret-list").
	then(function(result){
		return returner.prepare(result,'secret-list');
	}).
	then(function(result){
		console.log("Returner Result:\n",result);
		deferred.resolve(result);
	}).fail(deferred.reject);
	return deferred.promise;
}