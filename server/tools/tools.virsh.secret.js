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

function define(){
	tools.logger.info("Secret Define is called");
	var deferred = Q.defer();
	deferred.resolve("We are now defining");
	return deferred.promise;
}