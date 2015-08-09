var Q				= require('q');
//var config 			= require('../config/config.main.js');
var tools			= require('../tools/tools.main.js');

module.exports = {
	poolList: function(){
		var deferred = Q.defer();
		tools.runLocalCommand('virsh pool-list --all').then(
			function(result){
				result = result.trim().split("\n");
				result.splice(0,2);
				
				var toReturn = [];
				result.forEach(function(curPool){
					console.log(curPool.trim());
				});
				
				
				deferred.resolve(toReturn);
			}
		).fail( function(issue){ deferred.reject(issue); } );
		return deferred.promise;
	},
	poolDefine: function(command, resolveTo){
		return tools.runLocalCommand(command);
	}
};