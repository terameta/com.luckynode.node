var Q					= require('q');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');

module.exports = {
	list:		list,
	define:	define
};

function list(){
	tools.logger.info("Secret List is called");
	return  tools.runLocalCommand('virsh secret-list').then(function(result){ return returner.prepare(result, 'secret-list') });
}

function define(refObject){
	tools.logger.info("Secret Define is called");
	console.log(refObject);
	var deferred = Q.defer();
	deferred.resolve("We are now defining");
	exists(refObject);
	return deferred.promise;
}

function exists(refObject){
	var deferred = Q.defer();
	list().then(function(secretList){
		secretList.forEach(function(curSecret){
			console.log("Exists:", curSecret.UUID, refObject.secretuuid);
		});
	}).fail(deferred.reject);
	return deferred.promise;
}

function saveSecretXML(curPool){
	var deferred = Q.defer();
	var fs = require('fs');
	console.log("=============================================================");
	console.log("=============================================================");
	console.log(curPool);
	console.log("=============================================================");
	console.log("=============================================================");
	curPool.secretXML = "<secret ephemeral='no' private='yes'><uuid>"+curPool.secretuuid+"</uuid><usage type='ceph'><name>"+curPool.rbdname+" secret</name></usage></secret>";
	curPool.secretFile = '/tmp/'+curPool.id+'-secret.xml';
	fs.writeFile(curPool.secretFile, curPool.secretXML, function(err) {
		if (err){
			deferred.reject(err);
		} else {
			tools.logger.info("Secret XML file for the new pool " + curPool.id + " is saved.", true);
			deferred.resolve(curPool);
		}
	});
	return deferred.promise;
}