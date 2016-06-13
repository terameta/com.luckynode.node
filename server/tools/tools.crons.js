var tools 			= require("../tools/tools.main.js");
var virsh 			= require("../tools/tools.virsh.js");
var mongojs 		= require('mongojs');
var os  				= require('os-utils');
var Q					= require('q');

module.exports = function(db){
	
	var curModule = {
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

function everytensecs(){
	 console.log(new Date());
	 console.log(tools.getUserHome());
	 //console.log(tools.getNodes());
	 
}


function everyminute(){
	findResourceUsage();
	virsh.virshTools.server.list().then(function(serverList) {
		serverList.forEach(function(curServer) {
			virsh.virshTools.server.stateUpdate(curServer.Name);
		});
	});
}

function findResourceUsage(){
	var stats = {
		assignedCores: 0,
		assignedMemory: 0
	};
	nodeGetServersDB(stats).
		then(findCPUUsage).
		then(findCPUCount).
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
			stats.assignedServers = data.length;
			data.forEach(function(curServer){
				stats.assignedCores += parseInt(curServer.cpu,10);
				stats.assignedMemory += parseInt(curServer.ram, 10);
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

function findCPUCount(stats){
	var deferred = Q.defer();
	stats.cpuCount = os.cpuCount();
	deferred.resolve(stats);
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
	var deferred = Q.defer();
	tools.db.nodes.update({_id: mongojs.ObjectId(tools.whoamid)}, {$set: { stats }}, function(err, data){
		if(err){
			deferred.reject(err);
			console.log("Can't update node stats on database");
		} else {
			deferred.resolve(stats);
		}
	});
	return deferred.promise;
}