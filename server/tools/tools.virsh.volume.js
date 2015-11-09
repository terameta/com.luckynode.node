var Q				= require('q');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');
var virshMain		= require('../tools/tools.virsh.main.js');

module.exports = {
	create: create
};

function create(diskName, pool, size, type, bVol){
	var deferred = Q.defer();
	var theCmd  = 	'virsh vol-create-as --pool '+ pool;
		theCmd +=	' --name '+ diskName;
		theCmd +=	' --capacity '+ size +'G';
		theCmd += 	' --format ' + (type == 'qcow2' ? 'qcow2' : 'raw');
		theCmd +=	(type == 'qcow2' && bVol == 'CreateNew' ? ' --prealloc-metadata' : '');
		theCmd +=	(bVol != 'CreateNew' ? ' --backing-vol '+ bVol : '');
		theCmd +=	(bVol != 'CreateNew' ? ' --backing-vol-format qcow2' : '');
	tools.logger.info('createVolume command', theCmd);
	tools.runLocalCommand(theCmd).
		then(function(result){ tools.logger.info('createVolume succeeded', result); 	deferred.resolve(result); }).
		fail(function(issue){ tools.logger.error('createVolume failed', issue);			deferred.reject(issue); });
	return deferred.promise;
}