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
	tools.db.servers.find({ node: tools.whoamid }, function(err, data) {
		if (err) {
			console.log("Server error", err);
		}
		else {
			console.log(data.length);
			console.log("List of Servers");
			data.forEach(function(curServer){
				console.log(curServer.name, curServer.cpu, curServer.ram);
				console.log(os);
				os.cpuCount(console.log);
				os.cpuUsage(console.log);
			});
			var stats = {};
			findCPUUsage(stats).
				then(findMemUsage).
				then(function(result){
					console.log("Deferred stats", stats);
				}).
				fail(function(issue){
					console.log(issue);
				});
		}
	});
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