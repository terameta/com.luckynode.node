var Q				= require('q');
//var config 			= require('../config/config.main.js');
var tools			= require('../tools/tools.main.js');

module.exports = {
	poolList: poolList,
	poolsDefine: poolsDefine,
	poolDefine: poolDefine,
	poolsRemove: poolsRemove,
	poolRemove: poolRemove
};

function poolsDefine(poolList){
	var topDeferred = Q.defer();
	var promises = [];
	poolList.forEach(function(curPool){
		var deferred = Q.defer();
		poolDefine(curPool).then(
			function(result){
				deferred.resolve(result);
			}
		).fail(
			function(issue){
				deferred.reject(issue);
			}
		);
		promises.push(deferred);
	});
	Q.all(promises).then(
		function(result){
			topDeferred.resolve(result);
		},
		function(issue){
			topDeferred.reject(issue);
		}
	);
	
	return topDeferred.promise;
}

function poolDefine(curPool){
	var deferred = Q.defer();
	var cL = []; //command List
	cL.push("virsh pool-define-as "+curPool.name+" netfs --source-host="+curPool.source.split(":")[0]+" --source-path="+curPool.source.split(":")[1]+" --target=/mnt/luckynodepools/"+curPool.name);
	cL.push('virsh pool-build ' + curPool.name);
	cL.push('virsh pool-autostart ' + curPool.name);
	cL.push('virsh pool-start ' + curPool.name);
	tools.runLocalCommands(cL).then(
		function(result){ console.log(result); deferred.resolve(result); }
	).fail(deferred.reject);
	
	return deferred.promise;
}

function poolsRemove(poolList){
	var topDeferred = Q.defer();
	console.log("We are now running pools remove");
	console.log(poolList);
	var promises = [];
	poolList.forEach(function(curPool){
		var deferred = Q.defer();
		poolRemove(curPool).then(
			function(result){
				deferred.resolve(result);
			}
		).fail(
			function(issue){
				deferred.reject(issue);
			}
		);
		promises.push(deferred);
	});
	Q.all(promises).then(
		function(result){
			console.log("Top deferred will now be resolved:", result);
			topDeferred.resolve(result);
		},
		function(issue){
			console.log("Top deferred will now be rejected:", issue);
			topDeferred.reject(issue);
		}
	);
	
	return topDeferred.promise;
}

function poolRemove(curPool){
	console.log("==========================");
	console.log("Running poolRemove");
	console.log(curPool);
	var deferred = Q.defer();
	var cL = []; //command List
	if(curPool.isactive) cL.push('virsh pool-destroy ' + curPool.name);
	cL.push('virsh pool-delete ' + curPool.name);
	cL.push('virsh pool-undefine ' + curPool.name);
	tools.runLocalCommands(cL).then(
		function(result){ 
			console.log("PoolRemove Result: ", result); 
			deferred.resolve(result); 
		}
	).fail(
		function(issue){
			deferred.reject(issue);
		}
	);
	return deferred.promise;
}

function poolList(){
	var deferred = Q.defer();
	tools.runLocalCommand('virsh pool-list --all').then(
		function(result){
			result = result.trim().split("\n");
			result.splice(0,2);
			
			var toReturn = [];
			result.forEach(function(curPoolSrc){
				var curPool = {};
				var curPoolDef = tools.splitBySpace(curPoolSrc);
				curPool.name = curPoolDef[0] || 'NoAssignedName';
				curPool.isactive = curPoolDef[1] || 'NoActive';
				curPool.isactive = curPool.isactive == 'active' ? true : false;
				curPool.isautostart = curPoolDef[2] || 'NoAutoStart';
				curPool.isautostart = curPool.isautostart == 'yes' ? true : false;
				toReturn.push(curPool);
			});
			deferred.resolve(toReturn);
		}
	).fail( function(issue){ deferred.reject(issue); } );
	return deferred.promise;
}