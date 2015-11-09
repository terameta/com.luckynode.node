var Q				= require('q');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');

module.exports = {
	getMostAvailablePool: getMostAvailablePool
};

function getMostAvailablePool(cSrv){
	tools.logger.info("getMostAvailablePool is called", { id: cSrv.id, name: cSrv.name });
	var deferred = Q.defer();
	if(cSrv.storeid){
		cSrv.storename = cSrv.store;
		cSrv.store = cSrv.storeid;
		tools.logger.info("getMostAvailablePool succeeded", { id: cSrv.id, name: cSrv.name, pool: cSrv.store });
		deferred.resolve(cSrv);
		return deferred.promise;
	}
	tools.runLocalCommand('virsh pool-list --details').then(function(result){
		result = result.trim().split("\n");
		result.splice(0,2);
		var curMaxFree = 0;
		var curMax = '';
		result.forEach(function(curPoolDetails){
			var curPool = tools.splitBySpace(curPoolDetails);
			
			var curSize = parseInt(curPool[8],10);
			if(curPool[9] == 'k') 		curSize *= 1000;
			if(curPool[9] == 'KB')		curSize *= 1000;
			if(curPool[9] == 'KiB') 	curSize *= 1024;
			if(curPool[9] == 'M') 		curSize *= 1000000;
			if(curPool[9] == 'MB') 		curSize *= 1000000;
			if(curPool[9] == 'MiB') 	curSize *= 1048576;
			if(curPool[9] == 'G') 		curSize *= 1000000000;
			if(curPool[9] == 'GB') 		curSize *= 1000000000;
			if(curPool[9] == 'GiB') 	curSize *= 1073741824;
			if(curPool[9] == 'T') 		curSize *= 1000000000000;
			if(curPool[9] == 'TB') 		curSize *= 1000000000000;
			if(curPool[9] == 'TiB') 	curSize *= 1099511627776;
			if(curPool[9] == 'P') 		curSize *= 1000000000000000;
			if(curPool[9] == 'PB') 		curSize *= 1000000000000000;
			if(curPool[9] == 'PiB') 	curSize *= 1125899906842624;
			if(curPool[9] == 'E') 		curSize *= 1000000000000000000;
			if(curPool[9] == 'EB') 		curSize *= 1000000000000000000;
			if(curPool[9] == 'EiB') 	curSize *= 1152921504606846976;
			tools.logger.info(curSize);
			if(curSize > curMaxFree){
				curMaxFree = curSize;
				curMax = curPool[0];
			}
			
		});
		if(curMax !=''){
			cSrv.store = curMax;
			tools.logger.info("getMostAvailablePool has succeeded", { id: cSrv.id, name: cSrv.name, pool: cSrv.store });
			deferred.resolve(cSrv);
		} else {
			tools.logger.error("getMostAvailablePool has failed", "There are no pools available");
			deferred.reject('There are no stores available');
		}
	}).fail(function(issue){
		tools.logger.error("getMostAvailablePool has failed", issue);
		deferred.reject(issue);
	});
	return deferred.promise;
}