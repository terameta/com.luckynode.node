var Q				= require('q');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');
var mongojs			= require('mongojs');

module.exports = {
	getFiles: getFiles,
	getPoolDetailsDB: getPoolDetailsDB,
	createImage: createImage
};

function createImage(a,b,c){
	var deferred = Q.defer();
	console.log(">>>>>>>>>>>>>>>>>>>>>>>>a:",a);
	console.log(">>>>>>>>>>>>>>>>>>>>>>>>b:",b);
	console.log(">>>>>>>>>>>>>>>>>>>>>>>>c:",c);
	return deferred.promise;
}

function getFiles(cPool){
	var deferred = Q.defer();
	tools.runLocalCommand('virsh vol-list --pool '+ cPool.id +' --details').then(function(result){ return returner.prepare(result, 'vol-list') }).then(deferred.resolve).fail(deferred.reject);
	return deferred.promise;
}

function getPoolDetailsDB(id){
	var deferred = Q.defer();
	tools.db.storages.findOne({_id:mongojs.ObjectId(id)}, function(err, pool){
		if(err){
			deferred.reject(err);
		} else if(!pool){
			deferred.reject("No pool with this ID");
		} else {
			deferred.resolve(pool);
		}
	});
	return deferred.promise;
}