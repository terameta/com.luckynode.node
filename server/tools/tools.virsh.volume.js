var Q				= require('q');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');
var virshMain		= require('../tools/tools.virsh.main.js');
var virshPool		= require('../tools/tools.virsh.pool.js');

module.exports = {
	create: 	create,
	resize:		resize
};

function create(diskName, pool, size, type, bVol){
	var deferred = Q.defer();
	tools.logger.info("CreateVolume Start", pool);
	
	virshPool.getPoolDetailsDB(pool).then(function(poolDetails){
		tools.logger.info("CreateVolume Pool Details Received", pool);
		
		var theCmd  = 	'virsh vol-create-as --pool '+ pool;
			theCmd +=	' --name '+ diskName;
			theCmd +=	' --capacity '+ size +'G';
			if(poolDetails.type== 'NFS') theCmd += 	' --format ' + (type == 'qcow2' ? 'qcow2' : 'raw');
			if(poolDetails.type== 'NFS') theCmd +=	(type == 'qcow2' && bVol == 'CreateNew' ? ' --prealloc-metadata' : '');
			if(poolDetails.type== 'NFS') theCmd +=	(bVol != 'CreateNew' ? ' --backing-vol '+ bVol : '');
			if(poolDetails.type== 'NFS') theCmd +=	(bVol != 'CreateNew' ? ' --backing-vol-format qcow2' : '');
			
		tools.logger.info('createVolume command', theCmd);
		tools.runLocalCommand(theCmd).
			then(function(result){ tools.logger.info('createVolume succeeded', result); 	deferred.resolve(result); }).
			fail(function(issue){ tools.logger.error('createVolume failed', issue);			deferred.reject(issue); });
		
	}).fail(deferred.reject);
	
	return deferred.promise;
}

function resize(name, pool, capacity){
	var deferred = Q.defer();
	var curCommand = "sudo virsh vol-resize --vol "+ name +" --pool "+ pool +" --capacity "+ capacity +"G";
	tools.runLocalCommand(curCommand).then(function(result) {
		deferred.resolve(result);
	}).fail(deferred.reject);
	return deferred.promise;
}