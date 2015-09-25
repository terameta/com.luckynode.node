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
	console.log("volDelete is called for " + cVol.name);
	var deferred = Q.defer();
	tools.runLocalCommand('virsh vol-delete --vol '+ cVol.id +'.qcow2 --pool '+ cVol.pool).then(function(result){
		deferred.resolve(result);
	}).fail(function(issue) {
		deferred.reject(issue);
	});
	return deferred.promise;
}

function volCloneFromServer(cSrv, cTarget){
	console.log("volCloneFromServer is called");
	var deferred = Q.defer();
	serverState(cSrv).
		then(serverShutDown).
		then(function(cSrv){
			var deferred = Q.defer();
			serverWaitForShutDown(cSrv, deferred);
			return deferred.promise;
		}).
		then(function(cSrv){
			volCloneFromServerStatusCheck(cSrv, cTarget, deferred.promise);
			return tools.runLocalCommand('virsh vol-clone --vol '+cSrv.id+'.qcow2 --newname '+ cTarget.id +'.qcow2 --pool '+cTarget.pool+' --prealloc-metadata');
		}).
		then(function(result){
			deferred.resolve(result);
		}).
		fail(function(issue){
			deferred.reject(issue);
		});
	return deferred.promise;
}

function volCloneFromServerStatusCheck(cSrv, cTarget, thePromise){
	console.log("The State:", thePromise.state);
	console.log(cSrv.id);
	console.log(cTarget.id);
	console.log(thePromise);
	setTimeout(function(){
		volCloneFromServerStatusCheck(cSrv, cTarget, thePromise);
	}, 5000);
}

function serverVNCAddress(cSrv){
	console.log("serverVNCAddress is called for:", cSrv.id);
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
	console.log("serverReboot is called for:", cSrv.id);
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
	console.log("serverStart is called for:", cSrv.id);
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
	console.log("serverPowerOff is called for:", cSrv.id);
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
	console.log("serverShutDown is called for:", cSrv.id);
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
	console.log("serverAttachISO is called for:", details);
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
	console.log("serverEjectISO is called for:", details);
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
	console.log("poolListIsos is called for pool " + storage.name);
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
		console.log("poolListIsos succeeded for pool " + storage.name);
		deferred.resolve(toReturn);
	}).fail(function(issue) {
		console.log("poolListIsos failed for pool " + storage.name);
		deferred.reject(issue);
	});
	return deferred.promise;
}

function nodeBridgeDetach(bridge){
	console.log("nodeBridgeDetach is called for bridge " + bridge);
	var deferred = Q.defer();
	
	tools.runLocalCommand('virsh iface-unbridge --bridge ' + bridge).then(function(result){
		console.log("nodeBridgeDetach succeeded for bridge "+ bridge);
		deferred.resolve(result);
		refreshDHCPConfig();
	}).fail(function(issue){
		console.log("nodeBridgeDetach failed for bridge "+ bridge);
		deferred.resolve(issue);
	});
	
	return deferred.promise;
}

function nodeBridgeAssign(bridge, iface){
	console.log("nodeBridgeAssign is called for bridge "+ bridge +" and interface " + iface);
	var deferred = Q.defer();
	var theCommands = [];
	theCommands.push('virsh iface-bridge --interface '+ iface +' --bridge '+ bridge +' --no-stp --delay 0');
	tools.runLocalCommands(theCommands).then(function(result){
		console.log("nodeBridgeAssign succeeded for bridge "+ bridge +" and interface " + iface);
		deferred.resolve(result);	
	}).fail(function(issue){
		console.log("nodeBridgeAssign failed for bridge "+ bridge +" and interface " + iface);
		console.log("We will cross check, but before, we will wait for 5 seconds");
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
				console.log("nodeBridgeAssign failed for bridge "+ bridge +" and interface " + iface +" in all possible ways."); deferred.reject("notok");
			}
		}).fail(function(issue){ console.log("nodeBridgeAssign failed for bridge "+ bridge +" and interface " + iface +" in all possible ways."); deferred.reject(issue); });
	});
	
	return deferred.promise;
}

function serverWriteDHCPItem(cSrv){
	console.log("writeServerDHCPItem is called");
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
			deferred.resolve(cSrv);
		}).fail(function(issue){
			deferred.reject(issue);
		});
	return deferred.promise;
}

function serverDeleteDHCPItem(cSrv){
	console.log("writeServerDHCPItem is called");
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
	console.log("refreshDHCPConfig is called");
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
			console.log("refreshDHCPConfig succeeded with interfaces:", interfaceString);
			deferred.resolve(result);
		}).fail(function(issue) {
			console.log("refreshDHCPConfig failed with interfaces:", interfaceString);
			deferred.reject(issue);
		});
	}).fail(function(issue) {
		deferred.reject(issue);
	});
	return deferred.promise;
}

function nodeInterfaceList(){
	console.log("nodeInterfaceList is called");
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
			console.log("nodeInterfaceList succeeded");
			deferred.resolve(toReturn);
		}
	).fail( function(issue){ console.log("nodeInterfaceList failed"); deferred.reject(issue); } );
	return deferred.promise;
}

function serverDiskList(cSrv){
	console.log("serverDiskList is called for " + cSrv.id);
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
			console.log("serverDiskList succeeded for " + cSrv.id);
			deferred.resolve(toReturn);
		}
	).fail( function(issue){ console.log("serverDiskList failed for " + cSrv.id); deferred.reject(issue); } );
	return deferred.promise;
}

function serverList(){
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
			deferred.resolve(toReturn);
		}
	).fail( function(issue){ deferred.reject(issue); } );
	
	return deferred.promise;
}

function serverDelete(cSrv){
	console.log("serverDelete called for " + cSrv.id);
	var deferred = Q.defer();
	
	serverState(cSrv).
		then(serverDeleteDHCPItem).
		then(serverDestroy).
		then(serverDeleteDiskFiles).
		then(serverUndefine).
		then( function(result){ 	console.log("serverDelete succeeded for " + cSrv.id);	deferred.resolve('success');	}).
		fail( function(issue){ 		console.log("serverDelete failed for " + cSrv.id);		deferred.reject(issue); 	});
	
	return deferred.promise;
}

function serverState(cSrv){
	console.log("serverState called for " + cSrv.id);
	var deferred = Q.defer();
	serverList().then(
		function(domList){
			cSrv.domstate = 'notexist';
			domList.forEach(function(curDom){
				if(curDom.Name == cSrv.id) cSrv.domstate = curDom.State;
			});
			console.log("serverState succeeded for " + cSrv.id);
			deferred.resolve(cSrv);
		}
	).fail( function(issue){ console.log("serverState failed for " + cSrv.id);		deferred.reject(issue); } );
	return deferred.promise;
}

function serverDestroy(cSrv){
	console.log("serverDestroy called for " + cSrv.id);
	var deferred = Q.defer();
	if(cSrv.domstate == 'shutoff'){
		console.log("serverDestroy succeeded for " + cSrv.id);
		deferred.resolve(cSrv);
	} else if(cSrv.domstate == 'notexist'){
		console.log("serverDestroy succeeded for " + cSrv.id);
		deferred.resolve(cSrv);
	} else {
		tools.runLocalCommand('virsh destroy '+cSrv.id).
			then( function(result){ 	console.log("serverDestroy succeeded for " + cSrv.id); 	cSrv.serverDestroyResult = result; 		deferred.resolve(cSrv);	}).
			fail( function(issue){ 		console.log("serverDestroy failed for " + cSrv.id);		console.log(issue);						deferred.reject(issue); 	});
	}
	return deferred.promise;
}

function serverDeleteDiskFiles(cSrv){
	console.log("serverDeleteDiskFiles is called for " + cSrv.id);
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
			then( function(result){ 	console.log("serverDeleteDiskFiles succeeded for " + cSrv.id);	cSrv.serverDeleteDiskFilesResult = result; deferred.resolve(cSrv);	}).
			fail( function(issue){ 		console.log("serverDeleteDiskFiles failed for " + cSrv.id);		deferred.reject(issue); 	});
	}
	return deferred.promise;
}

function serverCheckDiskFiles(cSrv){
	console.log("serverCheckDiskFiles is called for " + cSrv.id );
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
				console.log("serverCheckDiskFiles succeeded for " + cSrv.id );
				deferred.resolve(toReturn);
			}
		).
		fail( function(issue){ 		console.log("serverCheckDiskFiles failed for " + cSrv.id );		deferred.reject(issue); 	});
	return deferred.promise;
}

function serverUndefine(cSrv){
	console.log("serverUndefine is called for " + cSrv.id );
	var deferred = Q.defer();
	if(cSrv.domstate == 'notexist'){
		console.log("serverUndefine succeeded for " + cSrv.id );
		deferred.resolve(cSrv);
	} else {
		tools.runLocalCommand('virsh undefine '+ cSrv.id).
			then( function(result){ 	console.log("serverUndefine succeeded for " + cSrv.id );	cSrv.serverUndefineResult = result; deferred.resolve(cSrv);	}).
			fail( function(issue){ 		console.log("serverUndefine failed for " + cSrv.id );		deferred.reject(issue); 	});
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
	var deferred = Q.defer();
	if(cSrv.store){
		deferred.resolve();
		return deferred.promise;
	}
	tools.runLocalCommand('virsh pool-list --details').then(function(result){
		result = result.trim().split("\n");
		result.splice(0,2);
		var curMaxFree = 0;
		var curMax = '';
		result.forEach(function(curPoolDetails){
			var curPool = tools.splitBySpace(curPoolDetails);
			/*		console.log("Name: ", "|"+curPool[0]+"|");
			console.log("Status: ", "|"+curPool[1]+"|");
			console.log("AutoStart: ", "|"+curPool[2]+"|");
			console.log("Persistent: ", "|"+curPool[3]+"|");
			console.log("Capacity: ", "|"+curPool[4]+"|");
			console.log("Capacity Measure: ", "|"+curPool[5]+"|");
			console.log("Allocation: ", "|"+curPool[6]+"|");
			console.log("Allocation Measure: ", "|"+curPool[7]+"|");
			console.log("Available: ", "|"+curPool[8]+"|");
			console.log("Available Measure: ", "|"+curPool[9]+"|");*/
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
			console.log(curSize);
			if(curSize > curMaxFree){
				curMaxFree = curSize;
				curMax = curPool[0];
			}
			
		});
		if(curMax !=''){
			cSrv.store = curMax;
			deferred.resolve(cSrv);
		} else {
			deferred.reject('There are no stores available');
		}
	}).fail(function(issue){deferred.reject(issue);});
	return deferred.promise;
}

function composeDomainXML(cSrv){
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
	//console.log(cSrv);
	//console.log(cSrv.theXML);
	
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
			console.log("XML file for the new server " + cSrv.id + " is saved.");
			deferred.resolve(cSrv);
		}
	});
	return deferred.promise;
}

function createDomainDiskFile(cSrv){
	var deferred = Q.defer();
	var theCmd  = 	'virsh vol-create-as --pool '+ cSrv.store;
		theCmd +=	' --name '+ cSrv.id;
		theCmd +=	(cSrv.imageType == 'qcow2' ? '.qcow2' : '.img');
		theCmd +=	' --capacity '+ cSrv.hdd +'G';
		theCmd += 	' --format ' + (cSrv.imageType == 'qcow2' ? 'qcow2' : 'raw');
		theCmd +=	(cSrv.imageType == 'qcow2' ? ' --prealloc-metadata' : '');
	console.log(theCmd);
	tools.runLocalCommand(theCmd).
		then(function(result){ deferred.resolve(cSrv); }).
		fail(function(issue){ deferred.reject(issue); });
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