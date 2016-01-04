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
		console.log("We are creating disk");
		console.log("DiskName:", diskName);
		console.log("pool:", pool);
		console.log("size:",size);
		console.log("Type:", type);
		console.log("bVol:", bVol);
		console.log("PoolDetailsFromDB:",poolDetails);
		
		var theCmd  = 	'virsh vol-create-as --pool '+ pool;
			theCmd +=	' --name '+ diskName;
			theCmd +=	' --capacity '+ size +'G';
			if(poolDetails.type== 'NFS') theCmd += 	' --format ' + (type == 'qcow2' ? 'qcow2' : 'raw');
			if(poolDetails.type== 'NFS') theCmd +=	(type == 'qcow2' && bVol == 'CreateNew' ? ' --prealloc-metadata' : '');
			if(poolDetails.type== 'NFS') theCmd +=	(bVol != 'CreateNew' ? ' --backing-vol '+ bVol : '');
			if(poolDetails.type== 'NFS') theCmd +=	(bVol != 'CreateNew' ? ' --backing-vol-format qcow2' : '');
		
		if(poolDetails.type=='ceph'){
			var authStr = " --keyring /etc/ceph/ceph.client."+poolDetails.username+".keyring --id "+poolDetails.username+" -c /etc/ceph/ceph.conf";
			theCmd = "sudo rbd clone "+poolDetails.name+"/"+bVol+"@basesnap "+poolDetails.name+"/"+diskName+" "+authStr;
		}
			
		tools.logger.info('createVolume command', theCmd, true);
		tools.runLocalCommand(theCmd).
			then(function(result){ tools.logger.info('createVolume succeeded', result, true); 	deferred.resolve(result); }).
			fail(function(issue){ tools.logger.error('createVolume failed', issue, true);			deferred.reject(issue); });
		
	}).fail(deferred.reject);
	
	return deferred.promise;
}

function resize(name, pool, capacity){
	var deferred = Q.defer();
	var commandList = [];
	commandList.push("virsh pool-refresh --pool " + pool);
	commandList.push("sudo virsh vol-resize --vol "+ name +" --pool "+ pool +" --capacity "+ capacity +"G");
	tools.runLocalCommands(commandList).then(function(result) {
		deferred.resolve(result);
	}).fail(deferred.reject);
	return deferred.promise;
}