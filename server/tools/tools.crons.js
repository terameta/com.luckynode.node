var tools 			= require("../tools/tools.main.js");
var virsh 			= require("../tools/tools.virsh.js");
var mongojs 		= require('mongojs');
var os  				= require('os-utils');
var Q					= require('q');

module.exports = function(){
	 var curModule = {
		  kekele: getCollectionNames,
		  everytensecs: everytensecs,
		  everyminute: everyminute
	 };
	 /*
	 curModule.everytensecs = function(){
		  console.log(new Date(), topDB, db);
	 };
	 */
	 
	 return curModule;
};

function getCollectionNames(){
	console.log("This is kekele");
}

function everytensecs(){
	 console.log(new Date(), "Ten Secs");
	 findResourceUsage();
}


function everyminute(){
	console.log("This is everyminute");
}

function findResourceUsage(){
	var stats = {
		assignedCores: 0,
		assignedMemory: 0
	};
	nodeGetServersDB(stats).
		then(findCPUUsage).
		then(findMemUsage).
		then(findMemTotal).
		then(nodeUpdateStatsDB).
		then(function(result){
			console.log("Stats updated on the database");
		}).fail(function(issue){
			console.log("Stats update failed on the database");
			console.log(issue);
		});
}

function nodeGetServersDB(stats){
	var deferred = Q.defer();
	tools.db.servers.find({ node: tools.whoamid }, function(err, data) {
		if (err) {
			deferred.reject(err);
			console.log("Server error", err);
		}
		else {
			stats.assignedServers: data.length;
			data.forEach(function(curServer){
				stats.assignedCores += curServer.cpu;
				stats.assignedMemory += curServer.ram;
			});
			deferred.resolve(stats);
		}
	});
	return deferred.promise;
}

function findCPUUsage(stats){
	var deferred = Q.defer();
	os.cpuUsage(function(result){ stats.cpuUsage = result; deferred.resolve(stats);});
	return deferred.promise;
}

function findMemUsage(stats){
	var deferred = Q.defer();
	stats.memUsage = 1 - os.freememPercentage();
	deferred.resolve(stats);
	return deferred.promise;
}

function findMemTotal(stats){
	var deferred = Q.defer();
	stats.memTotal = os.totalmem();
	deferred.resolve(stats);
	return deferred.promise;
}

function nodeUpdateStatsDB(stats){
	tools.db.nodes.update({_id: mongojs.ObjectId(tools.whoamid)}, {$set: { stats }}, function(err, data){
		if(err){
			deferred.reject(err);
			console.log("Can't update node stats on database");
		} else {
			deferred.resolve(stats);
		}
	});
}