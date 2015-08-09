var Q			= require('q');
var config 		= require('../config/config.main.js');
var jwt			= require('jsonwebtoken');
var virsh 		= require('../tools/tools.virsh.js');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	apiRoutes.post('/assignstoragepools', tools.checkToken, function(req, res) {
		var newPools = [];
		if(req.body){ if(req.body.details){ if(req.body.details.length > 0){
			newPools = req.body.details;
		} } }
		
		if(newPools.length > 0){
			//Get the Existing Pools List
			var poolsToDefine = [];
			var poolsToRemove = [];
			virsh.poolList().then(
				function(exsPools){
					console.log(exsPools);
					console.log(newPools);
					newPools.forEach(function(curNewPool){
						var shouldDefine = true;
						exsPools.forEach(function(curExsPool){
							if(curExsPool.name == curNewPool.name && curExsPool.isactive && curExsPool.isautostart){
								shouldDefine = false;
							}
						});
						if(shouldDefine){
							poolsToDefine.push(curNewPool);
						}
					});
					
					console.log("Pools to define");
					console.log("===============");
					console.log(poolsToDefine);
					
					exsPools.forEach(function(curExsPool){
						var shouldRemove = true;
						newPools.forEach(function(curNewPool){
							if(curExsPool.name == curNewPool.name){
								shouldRemove = false;
							}
						});
						if(shouldRemove){
							poolsToRemove.push(curExsPool);
						}
					});
					
					console.log("Pools to Remove");
					console.log("===============");
					console.log(poolsToRemove);
					console.log("===============");console.log("===============");console.log("===============");console.log("===============");
					
					/*virsh.poolsDefine(poolsToDefine).then(
						function(result){
							console.log("Pools Define Succeded:", result);
						}
					).fail(
						function(issue){
							console.log("Pools Define Failed:", issue);
						}
					);*/
					virsh.poolsRemove(poolsToRemove).then(
						function(result){
							console.log("Pools Remove Succeeded:", result);
						}
					).fail(
						function(issue){
							console.log("Pools Remove Failed:", issue);
						}
					);
				}
			);
			
			
			
			return 0;
			
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
						var virshCommand = '';
						console.log("======Working on:", newPools[curNewPool].name);
						var curPoolDef = [];
						var shouldDefine = true;
						for(var curPool = 2; curPool < result.length; curPool++){
							curPoolDef = result[curPool].trim().split(/[\s,]+/);
							console.log(result[curPool].trim(), ">>>>>>>>>>>>>>>>>>>>>>>>",curPoolDef);
							if(curPoolDef[0] == newPools[curNewPool].name) shouldDefine = false;
						}
						if(shouldDefine){
							console.log("======This pool is not yet defined. We will now define");
							console.log("virsh pool-define-as store0 netfs --source-host=store0.luckynode.com --source-path=/var/store0 --target=/var/store0");
							virshCommand = "virsh pool-define-as " + newPools[curNewPool].name + " netfs";
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
						
						virshCommand = 'virsh pool-build ' + newPools[curNewPool].name;
						tools.runLocalCommand(virshCommand).then(
							function(result){ console.log(result.trim()); }
						).fail(
							function(issue){ console.log(issue.trim()); }
						);
						
						virshCommand = 'virsh pool-autostart ' + newPools[curNewPool].name;
						tools.runLocalCommand(virshCommand).then(
							function(result){ console.log(result.trim()); }
						).fail(
							function(issue){ console.log(issue.trim()); }
						);
						virshCommand = 'virsh pool-start ' + newPools[curNewPool].name;
						tools.runLocalCommand(virshCommand).then(
							function(result){ console.log(result.trim()); }
						).fail(
							function(issue){ console.log(issue.trim()); }
						);
					}
					
					console.log("===========================================================");
					console.log("Removing the non-assigned ones");
					console.log("===========================================================");
					for(var curPool = 2; curPool < result.length; curPool++){
						curPoolDef = result[curPool].trim().split(/[\s,]+/);
						var exsPoolName = curPoolDef[0] || 'NoName|||||||||||||||||||||||||||||';
						var exsPoolIsActive = curPoolDef[1] == 'active' ? true : false;
						var shouldRemove = true;
						for(var curNewPool = 0; curNewPool < newPools.length; curNewPool++){
							console.log(newPools[curNewPool]);
							console.log("Existing Pool:", exsPoolName);
							console.log("New Pool:",newPools[curNewPool].name);
							if(exsPoolName == newPools[curNewPool].name){
								shouldRemove = false;
							}
							console.log("Should Remove:", shouldRemove);
							console.log("Should Remove:", exsPoolName);
						}
						if(shouldRemove){
							console.log("<<<<<<<<<<<<<<<<<<<<<<<<||||||||||||||||||||||||||||||>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
							console.log("<<<<<<<<<<<<<<<<<<<<<<<<We are running removal for " + exsPoolName + ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
							virshCommand = "virsh pool-destroy " + exsPoolName;
							tools.runIfLocalCommand(virshCommand, exsPoolName, exsPoolIsActive).then(
								function(curPoolName){
									console.log(curPoolName);
									virshCommand = "virsh pool-delete " + curPoolName;
									return tools.runLocalCommand(virshCommand, curPoolName);
								}
							).then(
								function(curPoolName){
									console.log(curPoolName);
									virshCommand = "virsh pool-undefine " + curPoolName;
									return tools.runLocalCommand(virshCommand);
								}
							).then(
								function(result){
									console.log(result);
								}
							).fail(
								function(issue){
									console.log("<<<<<<<<<<<<<<<<<<<<<<<<||||||||||||||||||||||||||||||>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
									console.log("<<<<<<<<<<<<<<<<<<<<<<<<There is an issue with command>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
									console.log(issue);
									console.log(virshCommand);
								}
							);
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