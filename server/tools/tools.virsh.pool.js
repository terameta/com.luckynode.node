var Q				= require('q');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');

module.exports = {
	getFiles: getFiles
};

function getFiles(cPool){
	console.log("Pool getFiles called", cPool);
	var deferred = Q.defer();
	tools.runLocalCommand('virsh vol-list --pool '+ cPool.id +' --details').then(function(result){ return returner.prepare(result, 'vol-list') }).then(deferred.resolve).fail(deferred.reject);
	return deferred.promise;
}