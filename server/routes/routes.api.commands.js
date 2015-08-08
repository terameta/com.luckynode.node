var Q			= require('q');
var config 		= require('../config/config.main.js');
var jwt			= require('jsonwebtoken');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	apiRoutes.post('/assignstoragepools', tools.checkToken, function(req, res) {
		var newPools = [];
		if(req.body){ if(req.body.details){ if(req.body.details.length > 0){
			newPools = req.body.details;
		} } }
		
		if(newPools.length > 0){
		
			var exec = require('child_process').exec;
			var cmd = 'virsh pool-list --all';
			
			exec(cmd, function(error, stdout, stderr) {
				if (error) {
					console.log(stderr);
				} else {
					console.log(stdout);
					
					
					var result = stdout.trim().split("\n");
					var numPools = result.length - 2;
					if(numPools < 0) numPools = 0;
					
					
					console.log("===# new Pools: ", newPools.length);
					console.log("===# exs Pools: ", numPools);
					console.log("================================");
					console.log("===We will now identify non-existing pools");
					for(var curNewPool = 0; curNewPool < newPools.length; curNewPool++){
						console.log("======Working on:", newPools[curNewPool].name);
						var curPoolDef = [];
						var shouldDefine = true;
						for(var curPool = 2; curPool < result.length; curPool++){
							curPoolDef = result[curPool].trim().split(/[\s,]+/);
							console.log(result[curPool], ">>>>>>>>>>>>>>>>>>>>>>>>",curPoolDef);
							if(curPoolDef[0] == newPools[curNewPool].name) shouldDefine = false;
						}
						if(shouldDefine){
							console.log("======This pool is not yet defined. We will now define");
							console.log("virsh pool-define-as store0 netfs --source-host=store0.luckynode.com --source-path=/var/store0 --target=/var/store0");
							var virshCommand = "virsh pool-define-as " + newPools[curNewPool].name + " netfs";
							virshCommand += " --source-host=" + newPools[curNewPool].source.split(":")[0];
							virshCommand += " --source-path=" + newPools[curNewPool].source.split(":")[1];
							virshCommand += " --target=/mnt/luckynodepools/"+newPools[curNewPool].name;
							
							tools.runLocalCommand(virshCommand).then(
								function(result){ console.log(result); }
							).fail(
								function(issue){ console.log(issue); }
							);
							console.log(virshCommand);
							console.log(newPools[curNewPool]);
						}
					}
				}
			});
			res.send("ok");
		} else {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		}
	});

	app.use('/api/command', apiRoutes);
};