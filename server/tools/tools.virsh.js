var Q				= require('q');
//var config 			= require('../config/config.main.js');
var tools			= require('../tools/tools.main.js');
var virshMain		= require('../tools/tools.virsh.main.js');
var virshTools 	= 
	{
		pool: 	require('../tools/tools.virsh.pool.js'),
		server:	require('../tools/tools.virsh.server.js')
	};		

module.exports = {
	poolList: 					poolList,
	poolListIsos: 				poolListIsos,
	poolsDefine: 				poolsDefine,
	poolDefine: 				poolDefine,
	poolsRemove: 				poolsRemove,
	poolRemove: 				poolRemove,
	serverDelete:				serverDelete,
	serverDestroy:				serverDestroy,
	serverDeleteDiskFiles:	serverDeleteDiskFiles,
	serverList:					serverList,
	serverDiskList:			serverDiskList,
	serverAttachISO:			serverAttachISO,
	serverEjectISO:			serverEjectISO,
	serverState:				serverState,
	serverShutDown:			serverShutDown,
	serverStart:				serverStart,
	serverReboot:				serverReboot,
	serverPowerOff:			serverPowerOff,
	serverVNCAddress:			serverVNCAddress,
	nodeInterfaceList:		virshMain.nodeInterfaceList,
	nodeBridgeAssign:			nodeBridgeAssign,
	nodeBridgeDetach:			nodeBridgeDetach,
	volCloneFromServer:		volCloneFromServer,
	volDelete:					volDelete,
	runVirsh:					runVirsh
};

function runVirsh(details){
	return virshTools[details.region][details.command](details.details);
}

function volDelete(cVol){
	tools.logger.info("volDelete is called for " + cVol.name);
	var deferred = Q.defer();
	tools.runLocalCommand('virsh vol-delete --vol '+ cVol.id +'.qcow2 --pool '+ cVol.pool).then(function(result){
		deferred.resolve(result);
	}).fail(function(issue) {
		deferred.reject(issue);
	});
	return deferred.promise;
}

function volCloneFromServer(cSrv, cTarget){
	tools.logger.info("volCloneFromServer is called");
	var deferred = Q.defer();
	serverState(cSrv).
		then(serverShutDown).
		then(function(cSrv){
			var deferred = Q.defer();
			serverWaitForShutDown(cSrv, deferred);
			return deferred.promise;
		}).
		then(function(cSrv){
			volCloneFromServerStatusCheck(cSrv, cTarget, deferred);
			return tools.runLocalCommand('virsh vol-clone --vol '+cSrv.id+'.qcow2 --newname '+ cTarget.id +'.qcow2 --pool '+cTarget.pool+' --prealloc-metadata');
			/*setTimeout(function(){
				deferred.resolve();
			}, 30000);
			return deferred.promise;*/
		}).
		then(function(result){
			deferred.resolve(result);
		}).
		fail(function(issue){
			deferred.reject(issue);
		});
	return deferred.promise;
}

function volCloneFromServerStatusCheck(cSrv, cTarget, theDeferred){
	if(theDeferred.promise.isPending()){
		var sourceSize = 0;
		var targetSize = 0;
		
		tools.runLocalCommand('du /mnt/luckynodepools/'+cTarget.pool+'/'+cSrv.id+'.qcow2').then(function(result) {
			sourceSize = parseInt(result.trim().split(' ')[0], 10);
			tools.runLocalCommand('du /mnt/luckynodepools/'+cTarget.pool+'/'+cTarget.id+'.qcow2').then(function(result) {
				targetSize = parseInt(result.trim().split(' ')[0], 10);
				theDeferred.notify(parseInt((targetSize / sourceSize * 100), 10) + '%');
			});
		});
		setTimeout(function(){
			volCloneFromServerStatusCheck(cSrv, cTarget, theDeferred);
		}, 10000);
	}
}

function serverVNCAddress(cSrv){
	tools.logger.info("serverVNCAddress is called for:"+cSrv.id);
	var deferred = Q.defer();
	var theCommand = 'virsh vncdisplay ' + cSrv.id;
	serverState(cSrv).then(function(result){
		if(cSrv.domstate != 'running'){
			cSrv.vncport = -1;
			deferred.resolve(cSrv);
		} else {
			tools.runLocalCommand(theCommand).then(function(result) {
				result = parseInt(result.replace(":", ""),10) + 5900;
				cSrv.vncport = result;
				deferred.resolve(cSrv);
			}).fail(function(issue) {
				deferred.reject(issue);
			});
		}
	}).fail(function(issue) {
		deferred.reject(issue);
	});
	return deferred.promise;
}

function serverReboot(cSrv){
	tools.logger.info("serverReboot is called for:"+cSrv.id);
	var deferred = Q.defer();
	var theCommand = 'virsh reboot ' + cSrv.id;
	serverState(cSrv).then(function(result) {
		if(cSrv.domstate == 'running'){
			tools.runLocalCommand(theCommand).then(function(result) {
				deferred.resolve(cSrv);
			}).fail(function(issue) {
				deferred.reject(issue);
			});
		} else {
			deferred.resolve(cSrv);
		}
	}).fail(function(issue) {
		deferred.reject(issue);
	});
	return deferred.promise;
}

function serverStart(cSrv){
	tools.logger.info("serverStart is called for:" + cSrv.id);
	var deferred = Q.defer();
	var theCommand = 'virsh start ' + cSrv.id;
	serverState(cSrv).
		then(serverWriteDHCPItem).
		then(function(result) {
			if(cSrv.domstate == 'shutoff'){
				tools.runLocalCommand(theCommand).then(function(result) {
					deferred.resolve(cSrv);
				}).fail(function(issue) {
					deferred.reject(issue);
				});
			} else {
				deferred.resolve(cSrv);
			}
		}).fail(function(issue) {
			deferred.reject(issue);
		});
	return deferred.promise;
}

function serverPowerOff(cSrv){
	tools.logger.info("serverPowerOff is called for:" + cSrv.id);
	var deferred = Q.defer();
	var theCommand = 'virsh destroy ' + cSrv.id;
	serverState(cSrv).then(function(result) {
		if(cSrv.domstate == 'running'){
			tools.runLocalCommand(theCommand).then(function(result) {
				deferred.resolve(cSrv);
			}).fail(function(issue) {
				deferred.reject(issue);
			});
		} else {
			deferred.resolve(cSrv);
		}
	}).fail(function(issue) {
		deferred.reject(issue);
	});
	return deferred.promise;
}

function serverShutDown(cSrv){
	tools.logger.info("serverShutDown is called for:"+ cSrv.id);
	var deferred = Q.defer();
	var theCommand = 'virsh shutdown ' + cSrv.id;
	serverState(cSrv).then(function(result) {
		if(cSrv.domstate == 'running'){
			tools.runLocalCommand(theCommand).then(function(result) {
				deferred.resolve(cSrv);
			}).fail(function(issue) {
				deferred.reject(issue);
			});
		} else {
			deferred.resolve(cSrv);
		}
	}).fail(function(issue) {
		deferred.reject(issue);
	});
	return deferred.promise;
}

function serverWaitForShutDown(cSrv, deferred){
	serverState(cSrv).then(function(result){
		if(result.domstate == 'shutoff'){
			deferred.resolve(cSrv);
		} else {
			setTimeout(function(){ serverWaitForShutDown(cSrv, deferred);}, 1000);
		}
	}).fail(function(issue){ deferred.reject(issue);});
}

function serverAttachISO(details){
	tools.logger.info("serverAttachISO is called", details);
	var deferred = Q.defer();
	var theCommand = 'virsh change-media'
						+' --domain '+ details.server 
						+' --source /mnt/luckynodepools/'+ details.pool +'/'+ details.iso
						+' --path '+ details.target
						+' --config';
	var theCurDom = {id: details.server};
	serverState(theCurDom).then(function(result){
		if(theCurDom.domstate == 'running'){
			theCommand += ' --live';
		}
		tools.runLocalCommand(theCommand).then(function(result){
			deferred.resolve(result);
		}).fail(function(issue){
			deferred.reject(issue);
		});
	}).fail(function(issue){
		deferred.reject(issue);
	});
	return deferred.promise;
}

function serverEjectISO(details){
	tools.logger.info("serverEjectISO is called", details);
	var deferred = Q.defer();
	var theCommand = 'virsh change-media --domain '+ details.server +' --path '+ details.target +' --config --eject';
	serverState({id: details.server}).then(function(result){
		if(result.domstate == 'running'){
			theCommand += ' --live';
		}
		tools.runLocalCommand(theCommand).then(function(result){
			deferred.resolve(result);
		}).fail(function(issue) {
			deferred.reject(issue);
		});
	}).fail(function(issue) {
		deferred.reject(issue);
	});
	return deferred.promise;
}

function poolListIsos(storage){
	tools.logger.info("poolListIsos is called for pool " + storage.name + ":" + storage.id);
	var deferred = Q.defer();
	tools.runLocalCommand('virsh vol-list '+ storage.id +' --details').then(function(result) {
		var toReturn = [];
		result = result.trim().split('\n');
		result.splice(0,2);
		result.forEach(function(curIsoSrc){
			var curIso = {};
			var curIsoDef = tools.splitBySpace(curIsoSrc);
			curIso.name = curIsoDef[0] || 'NoName';
			curIso.path = curIsoDef[1] || 'NoPath';
			curIso.type = curIsoDef[2] || 'NoType';
			curIso.capacity = curIsoDef[3]+curIsoDef[4] || 'NoCapacity';
			curIso.allocation = curIsoDef[5]+curIsoDef[6] || 'NoAllocation';
			if(curIso.path.substr(curIso.path.length - 4) == '.iso'){
				toReturn.push(curIso);
			}
		});
		tools.logger.info("poolListIsos succeeded for pool " + storage.name, result);
		deferred.resolve(toReturn);
	}).fail(function(issue) {
		tools.logger.error("poolListIsos failed for pool " + storage.name, issue);
		deferred.reject(issue);
	});
	return deferred.promise;
}

function nodeBridgeDetach(bridge){
	tools.logger.info("nodeBridgeDetach is called for bridge " + bridge);
	var deferred = Q.defer();
	
	tools.runLocalCommand('virsh iface-unbridge --bridge ' + bridge).then(function(result){
		tools.logger.info("nodeBridgeDetach succeeded for bridge "+ bridge, result);
		deferred.resolve(result);
		refreshDHCPConfig();
	}).fail(function(issue){
		tools.logger.error("nodeBridgeDetach failed for bridge "+ bridge, issue);
		deferred.resolve(issue);
	});
	
	return deferred.promise;
}

function nodeBridgeAssign(bridge, iface){
	tools.logger.info("nodeBridgeAssign is called for bridge "+ bridge +" and interface " + iface);
	var deferred = Q.defer();
	var theCommands = [];
	theCommands.push('virsh iface-bridge --interface '+ iface +' --bridge '+ bridge +' --no-stp --delay 0');
	tools.runLocalCommands(theCommands).then(function(result){
		tools.logger.info("nodeBridgeAssign succeeded for bridge "+ bridge +" and interface " + iface, result);
		deferred.resolve(result);	
	}).fail(function(issue){
		tools.logger.error("nodeBridgeAssign failed for bridge "+ bridge +" and interface " + iface, issue);
		tools.logger.info( "We will cross check, but before, we will wait for 5 seconds");
		tools.unfortunateWaiter(5000);
		nodeInterfaceList().then(function(result){
			var shouldResolve = false;
			result.forEach(function(curAdapter){
				if(curAdapter.name == bridge && curAdapter.state == 'active') shouldResolve = true;
			});
			if(shouldResolve){
				deferred.resolve("ok");
				refreshDHCPConfig();
			} else {
				tools.logger.error("nodeBridgeAssign failed for bridge "+ bridge +" and interface " + iface +" in all possible ways.", issue); deferred.reject("notok");
			}
		}).fail(function(issue){ tools.logger.info("nodeBridgeAssign failed for bridge "+ bridge +" and interface " + iface +" in all possible ways.", issue); deferred.reject(issue); });
	});
	
	return deferred.promise;
}

function serverDiskList(cSrv){
	tools.logger.info("serverDiskList is called for " + cSrv.id);
	var deferred = Q.defer();
	tools.runLocalCommand('virsh domblklist '+ cSrv.id +' --details').then(
		function(result){
			var toReturn = [];
			result = result.trim().split("\n");
			result.splice(0,2);
			result.forEach(function(curDiskSrc){
				var curDisk = {};
				var curDiskDef = tools.splitBySpace(curDiskSrc);
				curDisk.type 	= curDiskDef[0] || 'NoType';
				curDisk.device 	= curDiskDef[1] || 'NoDevice';
				curDisk.target	= curDiskDef[2] || 'NoTarget';
				curDisk.source	= curDiskDef[3] || 'NoSource';
				if(curDisk.source.indexOf('/mnt/luckynodepools')>=0){
					curDisk.store = curDisk.source.replace("/mnt/luckynodepools/", '').split("/")[0];
				}
				//console.log(curDisk);
				toReturn.push(curDisk);
			});
			tools.logger.info("serverDiskList succeeded for " + cSrv.id, result);
			deferred.resolve(toReturn);
		}
	).fail( function(issue){ tools.logger.info("serverDiskList failed for " + cSrv.id, issue); deferred.reject(issue); } );
	return deferred.promise;
}

function serverList(){
	tools.logger.info("serverList is called");
	var deferred = Q.defer();
	
	tools.runLocalCommand('virsh list --all').then(
		function(result){
			var toReturn = [];
			result = result.trim().split("\n");
			result.splice(0,2);
			result.forEach(function(curDomSrc){
				var curDom = {};
				curDomSrc = curDomSrc.replace(/shut down/gi, "shutdown");
				curDomSrc = curDomSrc.replace(/shut off/gi, "shutoff");
				var curDomDef = tools.splitBySpace(curDomSrc);
				curDom.Id 		= curDomDef[0] || 'NoId';
				curDom.Name 	= curDomDef[1] || 'NoName';
				curDom.State 	= curDomDef[2] || 'shutoff';
				toReturn.push(curDom);
			});
			tools.logger.info("serverList succeeded", toReturn);
			deferred.resolve(toReturn);
		}
	).fail( function(issue){ deferred.reject(issue); tools.logger.error("serverList faild", issue)} );
	
	return deferred.promise;
}

function serverDelete(cSrv){
	tools.logger.info("serverDelete called for " + cSrv.id);
	var deferred = Q.defer();
	
	serverState(cSrv).
		then(serverDeleteDHCPItem).
		then(serverDestroy).
		then(serverDeleteDiskFiles).
		then(serverUndefine).
		then( function(result){ 	tools.logger.info( "serverDelete succeeded for " + cSrv.id, cSrv);	deferred.resolve('success');	}).
		fail( function(issue){ 		tools.logger.error("serverDelete failed for " + cSrv.id, cSrv);		deferred.reject(issue); 		});
	
	return deferred.promise;
}

function serverState(cSrv){
	tools.logger.info("serverState called for " + cSrv.id);
	var deferred = Q.defer();
	serverList().then(
		function(domList){
			cSrv.domstate = 'notexist';
			domList.forEach(function(curDom){
				if(curDom.Name == cSrv.id) cSrv.domstate = curDom.State;
			});
			tools.logger.info("serverState succeeded for " + cSrv.id, cSrv);
			deferred.resolve(cSrv);
		}
	).fail( function(issue){ tools.logger.info("serverState failed for " + cSrv.id, issue);		deferred.reject(issue); } );
	return deferred.promise;
}

function serverDestroy(cSrv){
	tools.logger.info("serverDestroy called for " + cSrv.id);
	var deferred = Q.defer();
	if(cSrv.domstate == 'shutoff'){
		tools.logger.info("serverDestroy succeeded for " + cSrv.id);
		deferred.resolve(cSrv);
	} else if(cSrv.domstate == 'notexist'){
		tools.logger.info("serverDestroy succeeded for " + cSrv.id);
		deferred.resolve(cSrv);
	} else {
		tools.runLocalCommand('virsh destroy '+cSrv.id).
			then( function(result){ 	tools.logger.info( "serverDestroy succeeded for " + cSrv.id, result); 	cSrv.serverDestroyResult = result; 		deferred.resolve(cSrv);	}).
			fail( function(issue){ 		tools.logger.error("serverDestroy failed for " + cSrv.id, issue);												deferred.reject(issue); 	});
	}
	return deferred.promise;
}

function serverDeleteDiskFiles(cSrv){
	tools.logger.info("serverDeleteDiskFiles is called for " + cSrv.id);
	var deferred = Q.defer();
	if(cSrv.domstate == 'notexist'){
		deferred.resolve(cSrv);
	} else {
		serverCheckDiskFiles(cSrv).
			then(
				function(diskList){
					var ideferred = Q.defer();
					var theCmds = [];
					diskList.forEach(function(curDisk){
						theCmds.push('virsh vol-delete --vol '+curDisk+' --pool ' + cSrv.store);
					});
					tools.runLocalCommands(theCmds).
						then(function(result){ ideferred.resolve(cSrv); }).
						fail(function(issue){ ideferred.reject(issue); });
					
					return ideferred.promise;
				}
			).
			then( function(result){ 	tools.logger.info( "serverDeleteDiskFiles succeeded for " + cSrv.id, result);	cSrv.serverDeleteDiskFilesResult = result; deferred.resolve(cSrv);	}).
			fail( function(issue){ 		tools.logger.error("serverDeleteDiskFiles failed for " + cSrv.id, issue);		deferred.reject(issue); 	});
	}
	return deferred.promise;
}

function serverCheckDiskFiles(cSrv){
	tools.logger.info("serverCheckDiskFiles is called for " + cSrv.id );
	var deferred = Q.defer();
	tools.runLocalCommand('virsh vol-list '+cSrv.store+' --details').
		then(
			function(result){
				result = result.trim().split("\n");
				result.splice(0,2);
				
				var toReturn = [];
				result.forEach(function(curVolSrc){
					var curVol = {};
					var curVolDef = tools.splitBySpace(curVolSrc);
					curVol.name = curVolDef[0] || 'NoAssignedName';
					if(curVol.name.indexOf(cSrv.id.toString()) >= 0 ) toReturn.push(curVol.name);
				});
				tools.logger.info("serverCheckDiskFiles succeeded for " + cSrv.id, result);
				deferred.resolve(toReturn);
			}
		).
		fail( function(issue){ 		tools.logger.info("serverCheckDiskFiles failed for " + cSrv.id, issue );		deferred.reject(issue); 	});
	return deferred.promise;
}

function serverUndefine(cSrv){
	tools.logger.info("serverUndefine is called for " + cSrv.id );
	var deferred = Q.defer();
	if(cSrv.domstate == 'notexist'){
		tools.logger.info("serverUndefine succeeded for " + cSrv.id );
		deferred.resolve(cSrv);
	} else {
		tools.runLocalCommand('virsh undefine '+ cSrv.id).
			then( function(result){ 	tools.logger.info("serverUndefine succeeded for " + cSrv.id, result );	cSrv.serverUndefineResult = result; deferred.resolve(cSrv);	}).
			fail( function(issue){ 		tools.logger.info("serverUndefine failed for " + cSrv.id, issue );		deferred.reject(issue); 	});
	}
	return deferred.promise;
}

function poolsDefine(poolList){
	var promises = [];
	poolList.forEach(function(curPool){
		var deferred = Q.defer();
		poolDefine(curPool).then(
			function(result){
				deferred.resolve(result);
			}
		).fail(
			function(issue){
				deferred.reject(issue);
			}
		);
		promises.push(deferred.promise);
	});
	return Q.all(promises);
}

function poolDefine(curPool){
	var deferred = Q.defer();
	var cL = []; //command List
	cL.push("virsh pool-define-as "+curPool.id+" netfs --source-host="+curPool.source.split(":")[0]+" --source-path="+curPool.source.split(":")[1]+" --target=/mnt/luckynodepools/"+curPool.name);
	cL.push('virsh pool-build ' + curPool.id);
	cL.push('virsh pool-autostart ' + curPool.id);
	cL.push('virsh pool-start ' + curPool.id);
	tools.runLocalCommands(cL).then(
		function(result){ deferred.resolve(result); }
	).fail(
		function(issue){ deferred.reject(issue); }
	);
	
	return deferred.promise;
}

function poolsRemove(poolList){
	var promises = [];
	poolList.forEach(function(curPool){
		var deferred = Q.defer();
		poolRemove(curPool).then(
			function(result){
				deferred.resolve(result);
			}).
		fail(
			function(issue){
				deferred.reject(issue);
			}
		);
		promises.push(deferred.promise);
	});
	return Q.all(promises);
}

function poolRemove(curPool){
	var deferred = Q.defer();
	var cL = []; //command List
	if(curPool.isactive) cL.push('virsh pool-destroy ' + curPool.name);
	cL.push('virsh pool-delete ' + curPool.name);
	cL.push('virsh pool-undefine ' + curPool.name);
	tools.runLocalCommands(cL).then(
		function(result){ 
			deferred.resolve(result); 
		},
		function(issue){
			deferred.reject(issue);
		}
	);
	return deferred.promise;
}

function poolList(){
	var deferred = Q.defer();
	tools.runLocalCommand('virsh pool-list --all').then(
		function(result){
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
}