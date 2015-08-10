var Q			= require('q');
var config 		= require('../config/config.main.js');
var jwt			= require('jsonwebtoken');
var virsh 		= require('../tools/tools.virsh.js');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	apiRoutes.post('definenetworkbridge', tools.checkToken, function(req, res){
		res.send("ok");
	});
	
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
					
					virsh.poolsDefine(poolsToDefine).then(
						function(result){
							console.log("Pools Define Succeded:", result);
						}
					).fail(
						function(issue){
							console.log("Pools Define Failed:", issue);
						}
					);
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
			res.send("ok");
		} else {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		}
	});

	app.use('/api/command', apiRoutes);
};