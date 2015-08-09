var Q				= require('q');
//var config 			= require('../config/config.main.js');
var tools			= require('../tools/tools.main.js');

module.exports = {
	poolList: function(){
		var deferred = Q.defer();
		tools.runLocalCommand('virsh pool-list --all').then(
			function(result){
				console.log(result);
				console.log("___________________");
				result = result.trim().split("\n");
				result.splice(0,2);
				
				var toReturn = [];
				result.forEach(function(curPoolSrc){
					var curPool = {};
					var curPoolDef = tools.splitBySpace(curPoolSrc);
					curPool.name = curPoolDef[0] || 'NoAssignedName';
					curPool.isactive = curPoolDef[1] || 'NoActive';
					curPool.isactive = curPool.isactive == 'active' ? true : false;
					curPool.isautostart = curPoolDef[2] || 'NoAutoStart';
					curPool.isautostart = curPool.isautostart == 'yes' ? true : false;
					toReturn.push(curPool);
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