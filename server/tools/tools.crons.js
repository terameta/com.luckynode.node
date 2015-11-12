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