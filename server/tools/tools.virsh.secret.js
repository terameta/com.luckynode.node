var Q					= require('q');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');

module.exports = {
	list:		list
};

function list(){
	tools.logger.info("serverList is called");
	return  tools.runLocalCommand('virsh secret-list').then(function(result){ return returner.prepare(result, 'secret-list') });
}