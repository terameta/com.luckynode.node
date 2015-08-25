var Q				= require('q');
//var config 			= require('../config/config.main.js');
var tools			= require('../tools/tools.main.js');

module.exports = {
	poolList: poolList,
	poolsDefine: poolsDefine,
	poolDefine: poolDefine,
	poolsRemove: poolsRemove,
	poolRemove: poolRemove,
	serverDefine:serverDefine,
	serverDelete:serverDelete,
	serverDestroy:serverDestroy,
	serverDeleteDiskFiles:serverDeleteDiskFiles
};

function serverDelete(cSrv){
	var deferred = Q.defer();
	serverState(cSrv).
		then(serverDestroy).
		then(serverDeleteDiskFiles).
		then(serverUndefine).
		then( function(result){ 	deferred.resolve(result);	}).
		fail( function(issue){ 		deferred.reject(issue); 	});
	return deferred.promise;
}

function serverState(cSrv){
	var deferred = Q.defer();
	
	tools.runLocalCommand('virsh list --all').then(
		function(result){
			result = result.trim().split("\n");
			result.splice(0,2);
			
			cSrv.domstate = 'shutoff';
			result.forEach(function(curDomSrc){
				var curDom = {};
				curDomSrc = curDomSrc.replace(/shut down/gi, "shutdown");
				curDomSrc = curDomSrc.replace(/shut off/gi, "shutoff");
				var curDomDef = tools.splitBySpace(curDomSrc);
				curDom.Id 		= curDomDef[0] || 'NoId';
				curDom.Name 	= curDomDef[1] || 'NoName';
				curDom.State 	= curDomDef[2] || 'shutoff';
				if(curDom.Name == cSrv.id) cSrv.domstate = curDom.State;
			});
			deferred.resolve(cSrv);
		}
	).fail( function(issue){ deferred.reject(issue); } );
	
	return deferred.promise;
}

function serverDestroy(cSrv){
	var deferred = Q.defer();
	if(cSrv.domstate == 'shutoff'){
		deferred.resolve(cSrv);
	} else {
		tools.runLocalCommand('virsh destroy '+cSrv.id).
			then( function(result){ 	cSrv.serverDestroyResult = result; deferred.resolve(cSrv);	}).
			fail( function(issue){ 	console.log(issue);	deferred.reject(issue); 	});
	}
	return deferred.promise;
}

function serverDeleteDiskFiles(cSrv){
	var deferred = Q.defer();
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
		then( function(result){ 	cSrv.serverDeleteDiskFilesResult = result; deferred.resolve(cSrv);	}).
		fail( function(issue){ 		deferred.reject(issue); 	});
	return deferred.promise;
}

function serverCheckDiskFiles(cSrv){
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
				deferred.resolve(toReturn);
			}
		).
		fail( function(issue){ 		deferred.reject(issue); 	});
	return deferred.promise;
}

function serverUndefine(cSrv){
	var deferred = Q.defer();
	tools.runLocalCommand('virsh undefine '+ cSrv.id).
		then( function(result){ 	cSrv.serverUndefineResult = result; deferred.resolve(cSrv);	}).
		fail( function(issue){ 		deferred.reject(issue); 	});
	return deferred.promise;
}

function serverDefine(cSrv){
	var deferred = Q.defer();
	if(!cSrv.architecture) 											cSrv.architecture = 'x86_64';
	if(!cSrv.imageType) 											cSrv.imageType = 'qcow2';
	if(cSrv.netdriver != 'rtl8139' && cSrv.netdriver != 'e1000') 	cSrv.netdriver = 'virtio';
	if(cSrv.diskdriver != 'ide')									cSrv.diskdriver = 'virtio';
	if(!cSrv.bridge)												cSrv.bridge = 'br0';
	
	getMostAvailablePool(cSrv).
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
	cL.push("virsh pool-define-as "+curPool.name+" netfs --source-host="+curPool.source.split(":")[0]+" --source-path="+curPool.source.split(":")[1]+" --target=/mnt/luckynodepools/"+curPool.name);
	cL.push('virsh pool-build ' + curPool.name);
	cL.push('virsh pool-autostart ' + curPool.name);
	cL.push('virsh pool-start ' + curPool.name);
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
	//We should eventually control the vnc ports
// 	+	'		<graphics type=\'vnc\' port=\'5901\' passwd=\'Xw2oACxc\' listen=\'0.0.0.0\'/>'	+ '\n'
	+	'		<video><model type=\'vga\' vram=\'9216\' heads=\'1\'/></video>'											+ '\n'
	+	'	</devices>'																									+ '\n'
	+ 	'</domain>';
	cSrv.theXML = theXML;
	console.log(cSrv);
	console.log(cSrv.theXML);
	
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