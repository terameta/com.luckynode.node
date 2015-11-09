var Q				= require('q');
//var config 			= require('../config/config.main.js');
var tools			= require('../tools/tools.main.js');
var virshTools 	= 
	{
		pool: require('../tools/tools.virsh.pool.js')
	};		
var fs				= require('fs');

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
	serverResize:serverResize,
	nodeInterfaceList:nodeInterfaceList,
	nodeBridgeAssign:nodeBridgeAssign,
	nodeBridgeDetach:nodeBridgeDetach,
	volCloneFromServer:volCloneFromServer,
	volDelete:volDelete,
	runVirsh:runVirsh
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

function serverResize(cSrv){
	console.log("serverResize is called for:", cSrv.id);
	tools.logger.info("serverResize is called for:"+cSrv.id);
	tools.logger.info(cSrv.id, cSrv);
	var deferred = Q.defer();
	//console.log(cSrv);
	
	cSrv.waitTime = 10000;
	
	if(cSrv.baseImage == 'CreateNew' && cSrv.status == 'defining'){
		deferred.resolve(cSrv);
	} else {
		volResize(cSrv).
			then(enableNBD).
			then(findFreeNBD).
			then(lockFreeNBD).
			then(describeNBD).
			then(resizeNBDPartition).
			then(checkNBDFileSystem).
			then(resizeNBDFileSystem).
			then(describeNBD).
			then(releaseNBD).
			then(deferred.resolve).fail(function(issue){
				console.log("Issue here:", issue);
				deferred.reject(issue);
				releaseNBD(cSrv);
			});
	}
	
	return deferred.promise;
}

function checkNBDFileSystem(cSrv){
	var deferred = Q.defer();
	var curCommand = "sudo e2fsck -p -f "+cSrv.targetNBD+"p"+cSrv.targetPartition;
	tools.runLocalCommand(curCommand).then(function(result){
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function resizeNBDFileSystem(cSrv){
	var deferred = Q.defer();
	var curCommand = "sudo resize2fs "+cSrv.targetNBD+"p"+cSrv.targetPartition;
	tools.runLocalCommand(curCommand).then(function(result){
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function releaseNBD(cSrv){
	var deferred = Q.defer();
	getNBDPID(cSrv).then(function(result){
		if(cSrv.NBDPID > 0){
			var curCommand = "sudo kill -SIGTERM "+cSrv.NBDPID;
			tools.runLocalCommand(curCommand).then(function(result){
				deferred.resolve(cSrv);
			}).fail(deferred.reject);
		} else {
			console.log("There is no NBD process attached to this guy");
			deferred.resolve(cSrv);
		}
	}).fail(deferred.reject);
	return deferred.promise;
}

function getNBDPID(cSrv){
	var deferred = Q.defer();
	var curCommand = "ps aux | grep qemu-nbd";
	tools.runLocalCommand(curCommand).then(function(result) {
		result = result.trim().split('\n');
		cSrv.NBDPID = 0;
		for(var i = 0; i < result.length; i++){
			if(result[i].indexOf(cSrv.id+'.qcow2') >= 0){
				cSrv.NBDPID = tools.splitBySpace(result[i])[1];
			}
		}
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function volResize(cSrv){
	var deferred = Q.defer();
	var curCommand = "sudo virsh vol-resize --vol "+cSrv.id+".qcow2 --pool "+ cSrv.store +" --capacity "+ cSrv.newsize+"G";
	tools.runLocalCommand(curCommand).then(function(result) {
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function resizeNBDPartition(cSrv){
	var deferred = Q.defer();
	var curCommand = "sudo parted "+ cSrv.targetNBD +" --script resizepart "+ cSrv.targetPartition +" 100% ";
	tools.runLocalCommand(curCommand).then(function(result) {
		console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>ResizeNBDPartition");
		console.log(curCommand);
		console.log("Result");
		console.log(result);
		console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function describeNBD(cSrv){
	var deferred = Q.defer();
	var curCommand = "sudo parted "+ cSrv.targetNBD +" --script unit KiB print";
	tools.runLocalCommand(curCommand).then(function(result) {
		console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>DescribNBD");
		console.log(curCommand);
		console.log("Result");
		console.log(result);
		console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
		result = result.trim().split('\n');
		var shouldWrite = false;
		var sizeOrder = 0, numberOrder = 0, filesystemOrder = 0;
		var listDisks = [];
		for(var t = 0; t < result.length; t++){
			if(shouldWrite){
				result[t] = tools.splitBySpace(result[t]);
				var curObj = {};
				curObj.number 		= result[t][numberOrder];
				curObj.size 		= result[t][sizeOrder];
				curObj.filesystem 	= result[t][filesystemOrder];
				curObj.realsize		= size2realsize(curObj.size);
				console.log(curObj);
				listDisks.push(curObj);
			} else if(result[t].substr(0,6) == 'Number'){
				result[t] = result[t].replace("File system", "FileSystem");
				var headers = tools.splitBySpace(result[t]);
				for(var q = 0; q < headers.length; q++){
					if(headers[q].trim() == 'Number') 		numberOrder = q;
					if(headers[q].trim() == 'Size')			sizeOrder = q;
					if(headers[q].trim() == 'FileSystem')	filesystemOrder = q;
				}
				shouldWrite = true;
			}
		}
		var curMax = 0, curMaxDisk = 0;
		for(var i = 0; i < listDisks.length; i++){
			if(listDisks[i].realsize >= curMax){
				curMax = listDisks[i].realsize;
				curMaxDisk = i;
			}
		}
		cSrv.targetPartition = listDisks[curMaxDisk].number;
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function size2realsize(srcSize, unit){
	if(!unit){
		var tmpSize = parseFloat(srcSize);
		unit = srcSize.replace(tmpSize.toString(10), '');
	}
	unit = unit.trim();
	var curSize = parseFloat(srcSize);
	if(unit == 'k') 		curSize *= 1000;
	if(unit == 'KB')		curSize *= 1000;
	if(unit == 'KiB') 		curSize *= 1024;
	if(unit == 'kiB') 		curSize *= 1024;
	if(unit == 'M') 		curSize *= 1000000;
	if(unit == 'MB') 		curSize *= 1000000;
	if(unit == 'MiB') 		curSize *= 1048576;
	if(unit == 'miB') 		curSize *= 1048576;
	if(unit == 'G') 		curSize *= 1000000000;
	if(unit == 'GB') 		curSize *= 1000000000;
	if(unit == 'GiB') 		curSize *= 1073741824;
	if(unit == 'giB') 		curSize *= 1073741824;
	if(unit == 'T') 		curSize *= 1000000000000;
	if(unit == 'TB') 		curSize *= 1000000000000;
	if(unit == 'TiB') 		curSize *= 1099511627776;
	if(unit == 'tiB') 		curSize *= 1099511627776;
	if(unit == 'P') 		curSize *= 1000000000000000;
	if(unit == 'PB') 		curSize *= 1000000000000000;
	if(unit == 'PiB') 		curSize *= 1125899906842624;
	if(unit == 'piB') 		curSize *= 1125899906842624;
	if(unit == 'E') 		curSize *= 1000000000000000000;
	if(unit == 'EB') 		curSize *= 1000000000000000000;
	if(unit == 'EiB') 		curSize *= 1152921504606846976;
	if(unit == 'eiB') 		curSize *= 1152921504606846976;
	return curSize;
}

function lockFreeNBD(cSrv){
	var deferred = Q.defer();
	var curCommand = "sudo qemu-nbd -c "+ cSrv.targetNBD +" /mnt/luckynodepools/"+cSrv.store+"/"+cSrv.id+".qcow2";
	tools.runLocalCommand(curCommand).then(function(result){
		deferred.resolve(cSrv);
	}).fail(function(issue){
		deferred.reject(issue);
	});
	return deferred.promise;
}

function enableNBD(cSrv){
	var deferred = Q.defer();
	var curCommand = 'sudo modprobe nbd max_part=63 nbds_max=64';
	tools.runLocalCommand(curCommand).then(function(result) {
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function findFreeNBD(cSrv){
	var deferred = Q.defer();
	var numNBD = findNumberofNBD();
	var shouldReject = false;
	var curCommand = 'ps aux | grep qemu-nbd';
	tools.runLocalCommand(curCommand).then(function(result) {
		result = result.split('\n');
		for(var t = 0; t < result.length; t++){
			if( result[t].indexOf(cSrv.id + '.qcow2') >= 0 ){
				//This virtual server is already mounted to an NBD device. Kill the assignment.
				shouldReject = true;
				break;
			}
			var logDN = result[t].indexOf('/dev/nbd');
			var theStr = '';
			if(logDN >= 0){
				theStr = result[t].substring(logDN, result[t].indexOf(' ', logDN));
			}
			if(numNBD.indexOf(theStr) >= 0){
				numNBD.splice(numNBD.indexOf(theStr), 1);
			}
		}
		if(numNBD.length > 0 && !shouldReject){
			cSrv.targetNBD = numNBD[0];
			deferred.resolve(cSrv);
		} else if(shouldReject){
			deferred.reject("This virtual server is already mounted to an NBD device. Kill the assignment.");
		} else {
			findFreeNBD(cSrv).then(deferred.resolve).fail(deferred.reject);
		}
	}).fail(deferred.reject);
	
	return deferred.promise;
}

function findNumberofNBD(){
	var i = 0;
	var toReturn = [];
	for(i=0; i < 999; i++){
		try{
			fs.accessSync('/dev/nbd'+i);
		} catch(e){
			break;
		}
		toReturn.push('/dev/nbd'+i);
	}
	return(toReturn);
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

function createDomainDiskFile(cSrv){
	tools.logger.info('createDomainDiskFile is called', cSrv);
	tools.logger.info('createDomainDiskFile baseimage', cSrv.baseImage);
	if(cSrv.baseImage == 'CreateNew'){
		tools.logger.info('createDomainDiskFile baseimage', 'a new one will be created');
	} else {
		tools.logger.info('createDomainDiskFile baseimage', 'existing one will be used');
	}
	var diskName  = 'disk-'+ cSrv.id +'-';
		 diskName += (cSrv.diskdriver == 'ide' ? 'hda' : 'vda');
		 diskName += (cSrv.imageType == 'qcow2' ? '.qcow2' : '.img');
	
	var deferred = Q.defer();
	createVolume(diskName, cSrv.store, cSrv.hdd, cSrv.imageType, cSrv.baseImage).
		then(function(result){ tools.logger.info('createDomainDiskFile succeeded', result); deferred.resolve(cSrv); }).
		fail(function( issue){ tools.logger.info('createDomainDiskFile failed   ', issue ); deferred.reject(issue); });
	
	return deferred.promise;
}

function createVolume(diskName, pool, size, type, bVol){
	var deferred = Q.defer();
	var theCmd  = 	'virsh vol-create-as --pool '+ pool;
		theCmd +=	' --name '+ diskName;
		theCmd +=	' --capacity '+ size +'G';
		theCmd += 	' --format ' + (type == 'qcow2' ? 'qcow2' : 'raw');
		theCmd +=	(type == 'qcow2' && bVol == 'CreateNew' ? ' --prealloc-metadata' : '');
		theCmd +=	(bVol != 'CreateNew' ? ' --backing-vol '+ bVol : '');
		theCmd +=	(bVol != 'CreateNew' ? ' --backing-vol-format qcow2' : '');
	tools.logger.info('createVolume command', theCmd);
	tools.runLocalCommand(theCmd).
		then(function(result){ tools.logger.info('createVolume succeeded', result); 	deferred.resolve(result); }).
		fail(function(issue){ tools.logger.error('createVolume failed', issue);			deferred.reject(issue); });
	return deferred.promise;
}

function createDomainandStart(cSrv){
	console.log("Create Domain and Start Called for " + cSrv.id);
	console.log(cSrv);
	var deferred = Q.defer();
	var theCmds = [];
	theCmds.push('virsh define /tmp/'+cSrv.id+'.xml');
	theCmds.push('virsh start '+cSrv.id);
	tools.runLocalCommands(theCmds).
		then(function(result){
			console.log("Server Created", cSrv.id);
			deferred.resolve(cSrv);
		}).
		fail(function(issue){
			console.log("Server create failed", cSrv.id);
			deferred.reject(issue);
		});
	return deferred.promise;
}