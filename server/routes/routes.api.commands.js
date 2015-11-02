var Q			= require('q');
//var config 		= require('../config/config.main.js');
//var jwt			= require('jsonwebtoken');
var virsh 		= require('../tools/tools.virsh.js');
var mongojs 	= require('mongojs');

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
		tools.logger.info("serverDelete is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details) {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details.id) {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			tools.logger.info("serverDelete is posted for " + req.body.details.id);
			virsh.serverDelete(req.body.details).
				then(function(result){ 		tools.logger.info( "serverDelete post succeeded for " + req.body.details.id);						res.send(result); 											}).
				fail(function(issue){ 		tools.logger.error("serverDelete post failed for " + req.body.details.id, issue);					res.status(500).json({ status: 'fail', detail: issue}); 	});
		}
	});
	
	apiRoutes.post('/serverDiskList', tools.checkToken, function(req, res){
		tools.logger.info("serverDiskList is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details) {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details.id) {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			tools.logger.info("serverDiskList is posted for " + req.body.details.id);
			virsh.serverDiskList(req.body.details).
				then(function(result){ 		tools.logger.info( "serverDiskList post succeeded for " + req.body.details.id);						res.send(result); 											}).
				fail(function(issue){ 		tools.logger.error("serverDiskList post failed for " + req.body.details.id, issue);					res.status(500).json({ status: 'fail', detail: issue}); 	});
		}
	});
	
	apiRoutes.post('/serverAttachISO', tools.checkToken, function(req, res){
		tools.logger.info("serverAttachISO is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details.iso || !req.body.details.pool || !req.body.details.server){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			tools.logger.info("serverAttachISO is posted with:", req.body.details);
			virsh.serverAttachISO(req.body.details).then(function(result){
				tools.logger.info("serverAttachISO post succeeded for " + req.body.details.server);
				res.send(result);
			}).fail(function(issue){
				tools.logger.info("serverAttachISO post failed for " + req.body.details.server, issue);
				res.send(issue);
			});
		}
		
	});
	
	apiRoutes.post('/serverEjectISO', tools.checkToken, function(req, res){
		tools.logger.info("serverEjectISO is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details.target || !req.body.details.server){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.serverEjectISO(req.body.details).then(function(result){
				res.send(result);
			}).fail(function(issue){
				res.status(500).json({ status: 'fail', detail: issue });
			});
		}
	});
	
	apiRoutes.post('/serverShutDown', tools.checkToken, function(req, res) {
		tools.logger.info("serverShutDown is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.serverShutDown(req.body.details).then(function(result){
				res.send(result);
			}).fail(function(issue){
				res.status(500).json({ status: 'fail', detail: issue });
			});
		}
	});
	
	apiRoutes.post('/serverPowerOff', tools.checkToken, function(req, res) {
		tools.logger.info("serverPowerOff is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.serverPowerOff(req.body.details).then(function(result){
				res.send(result);
			}).fail(function(issue){
				res.status(500).json({ status: 'fail', detail: issue });
			});
		}
	});
	
	apiRoutes.post('/serverStart', tools.checkToken, function(req, res) {
		tools.logger.info("serverStart is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.serverStart(req.body.details).then(function(result){
				res.send(result);
			}).fail(function(issue){
				res.status(500).json({ status: 'fail', detail: issue });
			});
		}
	});
	
	apiRoutes.post('/serverReboot', tools.checkToken, function(req, res) {
		tools.logger.info("serverReboot is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.serverReboot(req.body.details).then(function(result){
				res.send(result);
			}).fail(function(issue){
				res.status(500).json({ status: 'fail', detail: issue });
			});
		}
	});
	
	apiRoutes.post('/serverState', tools.checkToken, function(req, res) {
		tools.logger.info("serverState is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.serverState(req.body.details).then(function(result){
				res.send(result);
			}).fail(function(issue){
				res.status(500).json({ status: 'fail', detail: issue });
			});
		}
	});
	
	apiRoutes.post('/serverVNCAddress', tools.checkToken, function(req, res) {
		tools.logger.info("serverVNCAddress is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.serverVNCAddress(req.body.details).then(function(result){
				res.send(result);
			}).fail(function(issue){
				res.status(500).json({ status: 'fail', detail: issue });
			});
		}
	});
	
	apiRoutes.post('/serverResize', tools.checkToken, function(req, res){
		tools.logger.info("serverResize is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.serverResize(req.body.details).then(function(result){
				res.send(result);
			}).fail(function(issue){
				res.status(500).json({ status: "fail", detail: issue});
			});
		}
	});
	
	apiRoutes.post('/nodeInterfaceList', tools.checkToken, function(req, res){
		tools.logger.info('nodeInterfaceList is posted');
		virsh.nodeInterfaceList().
			then(function(result){	tools.logger.info( "nodeInterfaceList post succeeded"); 						res.json(result);										}).
			fail(function(issue){	tools.logger.error("nodeInterfaceList post failed", issue);						res.status(500).json({status:'fail', detail: issue});	});
	});
	
	apiRoutes.post('/nodeBridgeAssign', tools.checkToken, function(req, res){
		tools.logger.info('nodeBridgeAssign is posted');
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details) {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details.bridge) {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details.iface) {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.nodeBridgeAssign(req.body.details.bridge, req.body.details.iface).
				then(function(result){ 		tools.logger.info( "nodeBridgeAssign post succeeded");					res.send(result); 											}).
				fail(function(issue){ 		tools.logger.error("nodeBridgeAssign post failed", issue);				res.status(500).json({ status: 'fail', detail: issue}); 	});
		}
	});
	
	apiRoutes.post('/nodeBridgeDetach', tools.checkToken, function(req, res){
		tools.logger.info('nodeBridgeDetach is posted');
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details) {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details.bridge) {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.nodeBridgeDetach(req.body.details.bridge).
				then(function(result){ 		tools.logger.info( "nodeBridgeDetach post succeeded");					res.send(result); 											}).
				fail(function(issue){ 		tools.logger.error("nodeBridgeDetach post failed", issue);				res.status(500).json({ status: 'fail', detail: issue}); 	});
		}
	});
	
	apiRoutes.post('/poolListIsos', tools.checkToken, function(req, res){
		tools.logger.info("poolListIsos is posted");
		console.log(req.body);
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details._id){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.poolListIsos(req.body.details).then(function(result){
				res.json(result);
			}).fail(function(issue){
				res.status(500).json({ status: 'fail', detail: issue });
			});
		}
	});
	
	apiRoutes.post('/assignStoragePools', tools.checkToken, function(req, res) {
		var newPools = [];
		tools.logger.info("assignStoragePools is posted", req.body.details);
		if(req.body){ if(req.body.details){ if(req.body.details.length > 0){
			newPools = req.body.details;
		} } }
		
		if(newPools.length > 0){
			if(newPools[0].pool == 'NoAssignedPoolForTheNode' ) newPools = [];
			newPools.forEach(function(curNewPool) {
			   curNewPool.name = curNewPool.id; 
			});
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
					tools.logger.info("PoolsToDefine", poolsToDefine);
					tools.logger.info("PoolsToRemove", poolsToRemove);
					virsh.poolsDefine(poolsToDefine).then(
						function(result){
							tools.logger.info("Pools Define Succeded:", result);
						}
					).fail(
						function(issue){
							tools.logger.info("Pools Define Failed:", issue);
						}
					);
					virsh.poolsRemove(poolsToRemove).then(
						function(result){
							tools.logger.info("Pools Remove Succeeded:", result);
						}
					).fail(
						function(issue){
							tools.logger.info("Pools Remove Failed:", issue);
						}
					);
				}
			);
			res.send("ok");
		} else {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		}
	});

	apiRoutes.post('/volCloneFromServer', tools.checkToken, function(req, res){
		tools.logger.info("volCloneFromServer is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details.server || !req.body.details.target){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			res.send("ok");
			virsh.volCloneFromServer(req.body.details.server, req.body.details.target).then(function(result){
				db.images.update({_id: mongojs.ObjectId(req.body.details.target.id)}, {$set: {status: 'Enabled'}}, function(err, data){
					if(err){
						tools.logger.error("We were supposed to update the status of volume " + req.body.details.target.id, {error:err, result: result});
					}
				});
			}).fail(function(issue){
				db.images.update({_id: mongojs.ObjectId(req.body.details.target.id)}, {$set: {status: 'Failed: '+issue}}, function(err, data){
					if(err){
						tools.logger.error("We were supposed to update the status of volume " + req.body.details.target.id, {error:err, issue: issue});
					}
				});
			}).progress(function(status){
				tools.logger.info("Status:", status);
				db.images.update({_id: mongojs.ObjectId(req.body.details.target.id)}, {$set: {status: status}}, function(err, data){
					if(err){
						tools.logger.error("We were supposed to update the status of volume " + req.body.details.target.id, {error: err, status: status});
					}
				});
			});
		}
	});
	
	apiRoutes.post('/volDelete', tools.checkToken, function(req, res) {
		tools.logger.info("volDelete is posted");
		if(!req.body){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else if(!req.body.details.volume){
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		} else {
			virsh.volDelete(req.body.details.volume).then(function(result){
				res.json(result);
			}).fail(function(issue){
				res.status(500).json({ status: 'fail', detail: issue });
			});
		}
	});
	
	app.use('/api/command', apiRoutes);
};