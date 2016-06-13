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
	exists(refObject).
	then(saveXML).
	then(console.log);
	return deferred.promise;
}

function exists(refObject){
	var deferred = Q.defer();
	refObject.secretExists = false;
	list().then(function(secretList){
		secretList.forEach(function(curSecret){
			if(curSecret.UUID == refObject.secretuuid) refObject.secretExists = true;
		});
		deferred.resolve(refObject);
	}).fail(deferred.reject);
	return deferred.promise;
}

function saveXML(refObject){
	var deferred = Q.defer();
	var fs = require('fs');
	if(refObject.secretExists){
		deferred.resolve(refObject);
	} else {
		console.log("=============================================================");
		console.log(refObject);
		console.log("=============================================================");
		if(refObject.rbdname){
			refObject.secretName = refObject.rbdname + " secret";
		} else {
			refObject.secretName = refObject.name + " secret";
		}
		
		refObject.secretXML = "<secret ephemeral='no' private='yes'><uuid>"+refObject.secretuuid+"</uuid><usage type='ceph'><name>"+refObject.secretName+"</name></usage></secret>";
		refObject.secretFile = '/tmp/'+refObject.id+'-secret.xml';
		fs.writeFile(refObject.secretFile, refObject.secretXML, function(err) {
			if (err){
				deferred.reject(err);
			} else {
				tools.logger.info("Secret XML file for the new pool " + refObject.id + " is saved.", true);
				deferred.resolve(refObject);
			}
		});
	}
	return deferred.promise;
}