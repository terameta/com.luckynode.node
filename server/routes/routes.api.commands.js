var Q			= require('q');
//var config 		= require('../config/config.main.js');
//var jwt			= require('jsonwebtoken');
var virsh 		= require('../tools/tools.virsh.js');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	apiRoutes.post('/serverDefine', tools.checkToken, function(req, res){
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details) {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.serverDefine(req.body.details).
				then(function(result){
					res.send(result);
				}).
				fail(function(issue){
					res.status(500).json({ status: 'fail', detail: issue});
				});
		}
	});
	
	apiRoutes.post('/serverDelete', tools.checkToken, function(req, res){
		console.log("ServerDelete is called");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details) {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			
		}
	});
	
	apiRoutes.post('/defineNetworkBridge', tools.checkToken, function(req, res){
		//console.log(req.body);
		var iptobridge = '';
		if(req.body){ if(req.body.details) { if(req.body.details.ip){
			iptobridge = req.body.details.ip;
		} } }
		if( iptobridge === '' ){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			var toReturn = [];
			var os = require( 'os' );
	
			var networkInterfaces = os.networkInterfaces( );
			console.log(networkInterfaces);
			console.log("==================================================");
	
			for(var netKey in networkInterfaces){
				networkInterfaces[netKey].forEach(function(curAddr){
					if(curAddr.address == iptobridge){
						console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
						console.log("NetKey:",netKey);
						console.log("NIC:", networkInterfaces[netKey]);
						console.log("CurAddr:", curAddr);
						console.log("IPtoBridge", iptobridge);
						console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
					}
					if(!curAddr.internal){
						toReturn.push(curAddr.address);
					}
				});
				console.log(networkInterfaces[netKey]);
			}
			console.log(toReturn);
			res.send(iptobridge);
		}
	});
	
	apiRoutes.post('/assignStoragePools', tools.checkToken, function(req, res) {
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