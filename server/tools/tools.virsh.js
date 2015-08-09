var Q				= require('q');
//var config 			= require('../config/config.main.js');
var tools			= require('../tools/tools.main.js');

module.exports = {
	poolList: function(){
		var deferred = Q.defer();
		tools.runLocalCommand('virsh pool-list --all').then(
			function(result){
				deferred.resolve(result);
			}
		).fail( function(issue){ deferred.reject(issue); } );
		return deferred.promise;
	},
	poolDefine: function(command, resolveTo){
		return tools.runLocalCommand(command);
	}
};