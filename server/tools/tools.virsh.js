var Q				= require('q');
//var config 			= require('../config/config.main.js');
var tools			= require('../tools/tools.main.js');
var virshMain		= require('../tools/tools.virsh.main.js');
var virshTools 	= 
	{
		pool: 	require('../tools/tools.virsh.pool.js'),
		server:	require('../tools/tools.virsh.server.js'),
		main:		require('../tools/tools.virsh.main.js')
	};		

module.exports = {
	poolList: 					poolList,
	poolListIsos: 				poolListIsos,
	poolsDefine: 				poolsDefine,
	poolDefine: 				poolDefine,
	poolsRemove: 				poolsRemove,
	poolRemove: 				poolRemove,
	nodeInterfaceList:		virshMain.nodeInterfaceList,
	nodeBridgeAssign:			nodeBridgeAssign,
	nodeBridgeDetach:			nodeBridgeDetach,
	volCloneFromServer:		volCloneFromServer,
	volDelete:					volDelete,
	runVirsh:					runVirsh,
	virshTools:					virshTools
};

function runVirsh(details){
	return virshTools[details.region][details.command](details.details);
}

function volDelete(cVol){
	tools.logger.info("volDelete is called for " + cVol.name);
	var deferred = Q.defer();
	tools.runLocalCommand('virsh vol-delete --vol image-'+ cVol.id +'.qcow2 --pool '+ cVol.pool).then(function(result){
		deferred.resolve(result);
	}).fail(function(issue) {
		deferred.reject(issue);
	});
	return deferred.promise;
}

function volCloneFromServer(cSrv, cTarget){
	tools.logger.info("volCloneFromServer is called");
	var deferred = Q.defer();
	virshTools.server.state(cSrv).
		then(virshTools.server.shutdown).
		then(function(cSrv){
			var deferred = Q.defer();
			serverWaitForShutDown(cSrv, deferred);
			return deferred.promise;
		}).
		then(function(cSrv){
			var deferred = Q.defer();
			virshTools.server.diskList(cSrv).then(function(diskList){
				diskList.forEach(function(curDisk){
					console.log(curDisk);
					if(curDisk.Target == 'vda' || curDisk.Target == 'hda'){
						cTarget.pool = curDisk.Store;
						cTarget.srcvol = curDisk.Name;
					}
				});
				deferred.resolve(cSrv);
			}).fail(deferred.reject);
			return deferred.promise;
		}).
		then(function(cSrv){
			volCloneFromServerStatusCheck(cSrv, cTarget, deferred);
			return tools.runLocalCommand('virsh vol-clone --vol '+cTarget.srcvol+' --newname image-'+ cTarget.id +'.qcow2 --pool '+cTarget.pool+' --prealloc-metadata');
			/*setTimeout(function(){
				deferred.resolve();
			}, 30000);
			return deferred.promise;*/
		}).
		then(function(result){deferred.resolve(cTarget);}).
		fail(deferred.reject);
	return deferred.promise;
}

function volCloneFromServerStatusCheck(cSrv, cTarget, theDeferred){
	if(theDeferred.promise.isPending()){
		var sourceSize = 0;
		var targetSize = 0;
		
		console.log(cTarget);
		
		tools.runLocalCommand('du /mnt/luckynodepools/'+cTarget.pool+'/disk-'+cSrv.id+'-vda.qcow2').then(function(result) {
			sourceSize = parseInt(result.trim().split(' ')[0], 10);
			tools.runLocalCommand('du /mnt/luckynodepools/'+cTarget.pool+'/image-'+cTarget.id+'.qcow2').then(function(result) {
				targetSize = parseInt(result.trim().split(' ')[0], 10);
				theDeferred.notify(parseInt((targetSize / sourceSize * 100), 10) + '%');
			});
		});
		setTimeout(function(){
			volCloneFromServerStatusCheck(cSrv, cTarget, theDeferred);
		}, 10000);
	}
}

function serverWaitForShutDown(cSrv, deferred){
	virshTools.server.state(cSrv).then(function(result){
		if(result.domstate == 'shut off'){
			deferred.resolve(cSrv);
		} else {
			setTimeout(function(){ serverWaitForShutDown(cSrv, deferred);}, 1000);
		}
	}).fail(function(issue){ deferred.reject(issue);});
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

function poolsDefine(poolList){
	console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
	console.log(poolList);
	console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
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
	if(curPool.type == 'NFS'){
		deferred.resolve(poolDefineNFS(curPool));
	} else if(curPool.type == 'ceph'){
		deferred.resolve(poolDefineCeph(curPool));
	} else {
		deferred.reject("No pool type defined");
	}
	return deferred.promise;
}

function poolDefineNFS(curPool){
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

function poolDefineCeph(curPool){
	var deferred = Q.defer();
	console.log(curPool);
	poolSaveSecretXML(curPool).
	then(poolDefineVirshSecret).
	then(poolSecretSetValue).
	then(poolSavePoolXML).
	then(poolDefineVirshPool).
	then(poolSetAutostart).
	then(poolStart).
	then(function(curPool){
		deferred.resolve("OK");
	}).fail(deferred.reject);
	return deferred.promise;
}

function poolSaveSecretXML(curPool){
	var deferred = Q.defer();
	var fs = require('fs');
	curPool.secretXML = "<secret ephemeral='no' private='yes'><usage type='ceph'><name>client."+curPool.username+" secret</name></usage></secret>";
	curPool.secretFile = '/tmp/'+curPool.id+'-secret.xml';
	fs.writeFile(curPool.secretFile, curPool.secretXML, function(err) {
		if (err){
			deferred.reject(err);
		} else {
			tools.logger.info("Secret XML file for the new pool " + curPool.id + " is saved.", true);
			deferred.resolve(curPool);
		}
	});
	return deferred.promise;
}

function poolDefineVirshSecret(curPool){
	var deferred = Q.defer();
	tools.runLocalCommand("virsh secret-define --file " + curPool.secretFile).
	then(function(result){
		//console.log("Result:", result);
		curPool.secretuuid = result.toString().replace("Secret", "").replace("created", "").trim();
		//console.log("UUID", curPool.secretuuid);
		deferred.resolve(curPool);
	}).fail(deferred.reject);
	return deferred.promise;
}

function poolSecretSetValue(curPool){
	var deferred = Q.defer();
	tools.runLocalCommand("virsh secret-set-value --secret "+ curPool.secretuuid +" --base64 " + curPool.key).
	then(function(result){
		deferred.resolve(curPool);
	}).fail(deferred.reject);
	return deferred.promise;
}

function poolSavePoolXML(curPool){
	var deferred = Q.defer();
	var fs = require('fs');
	curPool.poolXML = "<pool type='rbd'>\n";
	curPool.poolXML+= "	<name>"+curPool.id+"</name>\n";
	curPool.poolXML+= "	<source>\n";
	curPool.poolXML+= "		<name>"+curPool.rbdname+"</name>\n";
	var sourcesList = curPool.source.split(',');
	sourcesList.forEach(function(curSource){
		//console.log(curSource);
		var curSourceDetails = {};
		curSourceDetails.address = curSource.trim().split(':')[0].trim();
		curSourceDetails.port = curSource.trim().split(':')[1].trim();
		//console.log(curSourceDetails);
	curPool.poolXML+= "		<host name='"+curSourceDetails.address+"' port='"+curSourceDetails.port+"' />\n";
	});
	curPool.poolXML+= "		<auth username='"+curPool.username+"' type='ceph'>\n";
	curPool.poolXML+= "			<secret uuid='"+curPool.secretuuid+"' />\n";
	curPool.poolXML+= "		</auth>\n";
	curPool.poolXML+= "	</source>\n";
	curPool.poolXML+= "</pool>\n";
	console.log(curPool.poolXML);
	curPool.poolFile = '/tmp/'+curPool.id+'-pool.xml';
	fs.writeFile(curPool.poolFile, curPool.poolXML, function(err) {
		if (err){
			deferred.reject(err);
		} else {
			tools.logger.info("Pool XML file for the new pool " + curPool.id + " is saved.", true);
			deferred.resolve(curPool);
		}
	});
	console.log("=========================================================");
	console.log(curPool);
	deferred.resolve(curPool);
	return deferred.promise;
}

function poolDefineVirshPool(curPool){
	var deferred = Q.defer();
	tools.runLocalCommand("virsh pool-define --file " + curPool.poolFile).
	then(function(result){
		deferred.resolve(curPool);
	}).fail(deferred.reject);
	return deferred.promise;
}

function poolSetAutostart(curPool){
	var deferred = Q.defer();
	tools.runLocalCommand("virsh pool-autostart " + curPool.id).
	then(function(result){
		deferred.resolve(curPool);
	}).fail(deferred.reject);
	return deferred.promise;
}

function poolStart(curPool){
	var deferred = Q.defer();
	tools.runLocalCommand("virsh pool-start " + curPool.id).
	then(function(result){
		deferred.resolve(curPool);
	}).fail(deferred.reject);
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
	console.log(cL);
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