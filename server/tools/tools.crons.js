var tools       = require("../tools/tools.main.js");
var virsh       = require("../tools/tools.virsh.js");
var mongojs     = require('mongojs');

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
	console.log(tools.whoami, tools.whoamid);
	tools.db.nodes.find({ _id: mongojs.ObjectId(tools.whoamid) }, function(err, data) {
		if (err) {
			console.log("Error", err);
		}
		else {
			console.log("This node");
			console.log(data);
		}
	});
	tools.db.servers.find({ node: tools.whoamid }, function(err, data) {
		if (err) {
			console.log("Server error", err);
		}
		else {
			console.log("List of Servers");
			console.log(data);
		}
	});
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
			});
		}
	});
}