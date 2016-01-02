var Q				= require('q');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');
var mongojs			= require('mongojs');

module.exports = {
	getFiles: getFiles,
	getPoolDetailsDB: getPoolDetailsDB,
	createImage: createImage
};

function createImage(newImage){
	var deferred = Q.defer();
	tools.logger.info("createImage is called", newImage.basefile,true);
	if(newImage.basePool.type == 'ceph'){
		var authStr = " --keyring /etc/ceph/ceph.client."+newImage.basePool.username+".keyring --id "+newImage.basePool.username+" -c /etc/ceph/ceph.conf";
		var snapname = "snap-"+newImage.baseDisk.Name;
		var theCmds = [];
		theCmds.push("sudo rbd mv "+newImage.basePool.name+"/"+newImage.baseDisk.Name+" "+newImage.targetPool.name+"/"+newImage.basefile + authStr);
		theCmds.push("sudo rbd snap create "+newImage.targetPool.name+"/"+newImage.basefile+"@"+snapname + authStr);
		theCmds.push("sudo rbd snap protect "+newImage.targetPool.name+"/"+newImage.basefile+"@"+snapname + authStr);
		theCmds.push("sudo rbd clone "+newImage.targetPool.name+"/"+newImage.basefile+"@"+snapname+" "+newImage.basePool.name+"/"+newImage.baseDisk.Name+" "+authStr);
		tools.runLocalCommands(theCmds).
		then(function(result){
			tools.logger.info("createImage is finished", newImage.basefile,true);
			deferred.resolve(result);
			console.log("Result:", result);
		}).fail(function(issue){
			tools.logger.info("createImage is failed", newImage.basefile,true);
			deferred.reject(issue);
			console.log("Issue:", issue);
		});
	} else {
		tools.runLocalCommand('virsh vol-clone --vol '+newImage.baseDisk.Name+' --newname image-'+ newImage.id +' --pool '+newImage.targetPool.id +' --prealloc-metadata').
		then(function(result){
			deferred.resolve(result);
			console.log("Result:", result);
		}).fail(function(issue){
			deferred.reject(issue);
			console.log("Issue:", issue);
		});
	}
	
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