var Q				= require('q');
//var config 			= require('../config/config.main.js');
var tools			= require('../tools/tools.main.js');

module.exports = {
	poolList: poolList,
	poolListIsos: poolListIsos,
	poolsDefine: poolsDefine,
	poolDefine: poolDefine,
	poolsRemove: poolsRemove,
	poolRemove: poolRemove,
	serverDefine:serverDefine,
	serverDelete:serverDelete,
	serverDestroy:serverDestroy,
	serverDeleteDiskFiles:serverDeleteDiskFiles,
	serverList:serverList,
	serverDiskList:serverDiskList,
	serverAttachISO:serverAttachISO,
	serverEjectISO:serverEjectISO,
	serverState:serverState,
	serverShutDown:serverShutDown,
	serverStart:serverStart,
	serverReboot:serverReboot,
	serverPowerOff:serverPowerOff,
	serverVNCAddress:serverVNCAddress,
	nodeInterfaceList:nodeInterfaceList,
	nodeBridgeAssign:nodeBridgeAssign,
	nodeBridgeDetach:nodeBridgeDetach,
	volCloneFromServer:volCloneFromServer,
	volDelete:volDelete
};

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
	tools.logger.info("poolListIsos is called for pool " + storage.name);
	var deferred = Q.defer();
	tools.runLocalCommand('virsh vol-list '+ storage.name +' --details').then(function(result) {
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

function serverWriteDHCPItem(cSrv){
	tools.logger.info("writeServerDHCPItem is called");
	var deferred = Q.defer();
	var theCommands = [];
	var nameservers = [];
		if(cSrv.nameserver1) nameservers.push(cSrv.nameserver1);
		if(cSrv.nameserver2) nameservers.push(cSrv.nameserver2);
	var theContent  = 'host '+ cSrv.id + '{';
		theContent += 'hardware ethernet '+ cSrv.mac +';';
		theContent += 'option routers '+ cSrv.gateway +';';
		theContent += 'option subnet-mask '+ cSrv.netmask +';';
		theContent += 'fixed-address '+ cSrv.ip +';';
		theContent += 'option domain-name-servers '+ nameservers.join(',') +';';
		theContent += '}';

	
	theCommands.push('cd && echo "'+ theContent +'" > dhcpd.conf.body.'+cSrv.id);
	tools.runLocalCommands(theCommands).
		then(refreshDHCPConfig).
		then(function(result){
			tools.logger.info("writeServerDHCPItem is succeeded", result);
			deferred.resolve(cSrv);
		}).fail(function(issue){
			tools.logger.error("writeServerDHCPItem is failed", issue);
			deferred.reject(issue);
		});
	return deferred.promise;
}

function serverDeleteDHCPItem(cSrv){
	tools.logger.info("writeServerDHCPItem is called");
	var deferred = Q.defer();
	var theCommands = [];
	theCommands.push('cd && rm dhcpd.conf.body.'+cSrv.id);
	tools.runLocalCommands(theCommands).
		then(refreshDHCPConfig).
		then(function(result){
			deferred.resolve(cSrv);
		}).fail(function(issue){
			deferred.reject(issue);
		});
	return deferred.promise;
}

function refreshDHCPConfig(){
	tools.logger.info("refreshDHCPConfig is called");
	var interfaceString = '';
	var deferred = Q.defer();
	var theCommands = [];
	nodeInterfaceList().then(function(result){
		var interfaceList = [];
		result.forEach(function(curInterface){
			if(curInterface.name != 'lo'){
				interfaceList.push(curInterface.name);
			}
		});
		interfaceString = interfaceList.join(' ');
		theCommands.push('sudo sh -c \'echo INTERFACE=\\\"'+ interfaceString +'\\\" > /etc/default/isc-dhcp-server\'');
		theCommands.push('cd && echo "subnet 0.0.0.0 netmask 0.0.0.0 {authoritative;default-lease-time 21600000;max-lease-time 432000000;}\\nddns-update-style none;\\n" > dhcpd.conf.head');
		theCommands.push('cd && echo "\\n" > dhcpd.conf.body.0');
		theCommands.push('cd && echo "\\n" > dhcpd.conf.body.1');
		theCommands.push('cd && sudo sh -c "cat dhcpd.conf.head dhcpd.conf.body* > /etc/dhcp/dhcpd.conf"');
		theCommands.push('sudo service isc-dhcp-server restart');
		tools.runLocalCommands(theCommands).then(function(result) {
			tools.logger.info("refreshDHCPConfig succeeded with interfaces:"+interfaceString, result);
			deferred.resolve(result);
		}).fail(function(issue) {
			tools.logger.error("refreshDHCPConfig failed with interfaces:"+interfaceString, issue);
			deferred.reject(issue);
		});
	}).fail(function(issue) {
		deferred.reject(issue);
	});
	return deferred.promise;
}

function nodeInterfaceList(){
	tools.logger.info("nodeInterfaceList is called");
	var deferred = Q.defer();
	tools.runLocalCommand('virsh iface-list --all').then(
		function(result){
			var toReturn = [];
			result = result.trim().split("\n");
			result.splice(0,2);
			result.forEach(function(curInterfaceSrc){
				var curInterface = {};
				var curInterfaceDef = tools.splitBySpace(curInterfaceSrc);
				curInterface.name = curInterfaceDef[0] || 'NoName';
				curInterface.state = curInterfaceDef[1] || 'NoState';
				curInterface.mac = curInterfaceDef[2] || 'NoMac';
				toReturn.push(curInterface);
				//console.log(curInterface);
			});
			tools.logger.info("nodeInterfaceList succeeded");
			deferred.resolve(toReturn);
		}
	).fail( function(issue){ tools.logger.info("nodeInterfaceList failed", issue); deferred.reject(issue); } );
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

function serverDefine(cSrv){
	var deferred = Q.defer();
	if(!cSrv.architecture) 											cSrv.architecture = 'x86_64';
	if(!cSrv.imageType) 											cSrv.imageType = 'qcow2';
	if(cSrv.netdriver != 'rtl8139' && cSrv.netdriver != 'e1000') 	cSrv.netdriver = 'virtio';
	if(cSrv.diskdriver != 'ide')									cSrv.diskdriver = 'virtio';
	if(!cSrv.bridge)												cSrv.bridge = 'br0';
	tools.logger.info("Defining Server " + cSrv.id, cSrv);
	
	serverWriteDHCPItem(cSrv).
		then(getMostAvailablePool).
		then(composeDomainXML).
		then(saveDomainXML).
		then(createDomainDiskFile).
		then(createDomainandStart).
		then(function(result){ deferred.resolve(cSrv); }).
		fail(function(issue){ deferred.reject(issue); });

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

function getMostAvailablePool(cSrv){
	tools.logger.info("getMostAvailablePool is called", { id: cSrv.id, name: cSrv.name });
	var deferred = Q.defer();
	if(cSrv.storeid){
		cSrv.storename = cSrv.store;
		cSrv.store = cSrv.storeid;
		tools.logger.info("getMostAvailablePool succeeded", { id: cSrv.id, name: cSrv.name, pool: cSrv.store });
		deferred.resolve(cSrv);
		return deferred.promise;
	}
	tools.runLocalCommand('virsh pool-list --details').then(function(result){
		result = result.trim().split("\n");
		result.splice(0,2);
		var curMaxFree = 0;
		var curMax = '';
		result.forEach(function(curPoolDetails){
			var curPool = tools.splitBySpace(curPoolDetails);
			
			var curSize = parseInt(curPool[8],10);
			if(curPool[9] == 'k') 		curSize *= 1000;
			if(curPool[9] == 'KB')		curSize *= 1000;
			if(curPool[9] == 'KiB') 	curSize *= 1024;
			if(curPool[9] == 'M') 		curSize *= 1000000;
			if(curPool[9] == 'MB') 		curSize *= 1000000;
			if(curPool[9] == 'MiB') 	curSize *= 1048576;
			if(curPool[9] == 'G') 		curSize *= 1000000000;
			if(curPool[9] == 'GB') 		curSize *= 1000000000;
			if(curPool[9] == 'GiB') 	curSize *= 1073741824;
			if(curPool[9] == 'T') 		curSize *= 1000000000000;
			if(curPool[9] == 'TB') 		curSize *= 1000000000000;
			if(curPool[9] == 'TiB') 	curSize *= 1099511627776;
			if(curPool[9] == 'P') 		curSize *= 1000000000000000;
			if(curPool[9] == 'PB') 		curSize *= 1000000000000000;
			if(curPool[9] == 'PiB') 	curSize *= 1125899906842624;
			if(curPool[9] == 'E') 		curSize *= 1000000000000000000;
			if(curPool[9] == 'EB') 		curSize *= 1000000000000000000;
			if(curPool[9] == 'EiB') 	curSize *= 1152921504606846976;
			tools.logger.info(curSize);
			if(curSize > curMaxFree){
				curMaxFree = curSize;
				curMax = curPool[0];
			}
			
		});
		if(curMax !=''){
			cSrv.store = curMax;
			tools.logger.info("getMostAvailablePool has succeeded", { id: cSrv.id, name: cSrv.name, pool: cSrv.store });
			deferred.resolve(cSrv);
		} else {
			tools.logger.error("getMostAvailablePool has failed", "There are no pools available");
			deferred.reject('There are no stores available');
		}
	}).fail(function(issue){
		tools.logger.error("getMostAvailablePool has failed", issue);
		deferred.reject(issue);
	});
	return deferred.promise;
}

function composeDomainXML(cSrv){
	tools.logger.info('composeDomainXML is called', cSrv);
	var deferred = Q.defer();
	var diskFile = '/mnt/luckynodepools/'+ cSrv.store +'/'+ cSrv.id +(cSrv.imageType == 'qcow2' ? '.qcow2' : '.img');
	var theXML = ''
	+ 	'<domain type=\'kvm\'>'																							+ '\n'
	+ 	'	<name>'+ cSrv.id +'</name>'																					+ '\n'
	//  <uuid>e5c82363-ceea-74a2-a678-c05ab504c669</uuid>																+ '\n'
	+ 	'	<description>'+ cSrv.name +'</description>'																	+ '\n'
	+ 	'	<memory unit=\'MiB\'>'+ cSrv.ram +'</memory>'																+ '\n'
	+ 	'	<maxMemory unit=\'MiB\'>'+ cSrv.ram +'</maxMemory>'															+ '\n'
	+ 	'	<currentMemory unit=\'MiB\'>'+ cSrv.ram +'</currentMemory>'													+ '\n'
	+ 	'	<vcpu placement=\'static\'>'+ cSrv.cpu +'</vcpu>'															+ '\n'
	+ 	'	<cpu><topology sockets=\'1\' cores=\''+ cSrv.cpu +'\' threads=\'1\'/></cpu>'								+ '\n'
	+ 	'	<os>'																										+ '\n'
	+ 	'		<type arch=\''+ cSrv.architecture +'\' machine=\'pc\'>hvm</type>'										+ '\n'
	+ 	'		<boot dev=\'hd\' />'																					+ '\n'
	+ 	'		<boot dev=\'cdrom\' />'																					+ '\n'
	+ 	'		<bootmenu enable=\'yes\' timeout=\'3000\' />'															+ '\n'
	+ 	'	</os>'																										+ '\n'
	+	'	<features><acpi /><apic /><pae /></features>'																+ '\n'
	+	'	<clock sync=\'localtime\'/>'																				+ '\n'
	+	'	<on_poweroff>destroy</on_poweroff>'																			+ '\n'
	+	'	<on_reboot>restart</on_reboot>'																				+ '\n'
	+	'	<on_crash>restart</on_crash>'																				+ '\n'
	+	'	<devices>'																									+ '\n'
	+	'		<disk type=\'file\' device=\'disk\'>'																	+ '\n'
	+	'			<driver name=\'qemu\' type=\''+ cSrv.imageType +'\' cache=\'none\' />'								+ '\n'
	+	'			<source file=\''+ diskFile +'\' />'																	+ '\n'
	+	'			<target dev=\''+ (cSrv.diskdriver == 'ide' ? 'hda' : 'vda') +'\' bus=\''+ cSrv.diskdriver +'\'/>'	+ '\n'
	+	'		</disk>'																								+ '\n'
	+	'		<disk type=\'file\' device=\'cdrom\'><target dev=\'hdc\'/><readonly/></disk>'							+ '\n'
	+	'		<disk type=\'file\' device=\'cdrom\'><target dev=\'hdd\'/><readonly/></disk>'							+ '\n'
	+	'		<interface type=\'bridge\'>'																			+ '\n'
	+	'			<model type=\''+ cSrv.netdriver +'\' />'															+ '\n'
	+	'			<source bridge=\''+ cSrv.bridge +'\'/>'																+ '\n'
	//for below target dev we should find a proper naming mechanism
//	+	'			<target dev=\'kvm255.0\'/>'																			+ '\n'
	+	'			<mac address=\''+ cSrv.mac +'\'/>'																	+ '\n'
	+	'		</interface>'																							+ '\n'
	+	'		<input type=\'tablet\'/>'																				+ '\n'
	+	'		<input type=\'mouse\'/>'																				+ '\n'
	+	'		<graphics type=\'vnc\' port=\'-1\' autoport=\'yes\' passwd=\''+ cSrv.id +'\' listen=\'0.0.0.0\'/>'		+ '\n'
	+	'		<video><model type=\'vga\' vram=\'9216\' heads=\'1\'/></video>'											+ '\n'
	+	'	</devices>'																									+ '\n'
	+ 	'</domain>';
	cSrv.theXML = theXML;
	tools.logger.info('composeDomainXML is completed with XML', cSrv.theXML);
	tools.logger.info('composeDomainXML is completed with XML, resulting status', cSrv);
	
	deferred.resolve(cSrv);
	return deferred.promise;
}

function saveDomainXML(cSrv){
	var deferred = Q.defer();
	var fs = require('fs');
	fs.writeFile('/tmp/'+cSrv.id+'.xml', cSrv.theXML, function(err) {
		if (err){
			deferred.reject(err);
		} else {
			tools.logger.info("XML file for the new server " + cSrv.id + " is saved.");
			deferred.resolve(cSrv);
		}
	});
	return deferred.promise;
}

function createDomainDiskFile(cSrv){
	tools.logger.info('createDomainDiskFile is called', cSrv);
	tools.logger.info('createDomainDiskFile baseimage', cSrv.baseImage);
	if(cSrv.baseImage == 'CreateNew'){
		tools.logger.info('createDomainDiskFile baseimage', 'a new one will be created');
	} else {
		tools.logger.info('createDomainDiskFile baseimage', 'existing one will be used');
	}
	var deferred = Q.defer();
	var theCmd  = 	'virsh vol-create-as --pool '+ cSrv.store;
		theCmd +=	' --name '+ cSrv.id;
		theCmd +=	(cSrv.imageType == 'qcow2' ? '.qcow2' : '.img');
		theCmd +=	' --capacity '+ cSrv.hdd +'G';
		theCmd += 	' --format ' + (cSrv.imageType == 'qcow2' ? 'qcow2' : 'raw');
		theCmd +=	(cSrv.imageType == 'qcow2' ? ' --prealloc-metadata' : '');
		theCmd +=	(cSrv.baseImage != 'CreateNew' ? ' --backing-vol '+cSrv.baseImage : '');
	tools.logger.info('createDomainDiskFile command', theCmd);
	tools.runLocalCommand(theCmd).
		then(function(result){ tools.logger.info('createDomainDiskFile succeeded', result); 	deferred.resolve(cSrv); }).
		fail(function(issue){ tools.logger.error('createDomainDiskFile failed', issue);			deferred.reject(issue); });
	return deferred.promise;
}

function createDomainandStart(cSrv){
	var deferred = Q.defer();
	var theCmds = [];
	theCmds.push('virsh define /tmp/'+cSrv.id+'.xml');
	theCmds.push('virsh start '+cSrv.id);
	tools.runLocalCommands(theCmds).
		then(function(result){
			deferred.resolve(cSrv);
		}).
		fail(function(issue){
			deferred.reject(issue);
		});
	return deferred.promise;
}