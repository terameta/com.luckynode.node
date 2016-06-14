var Q					= require('q');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');
var virshMain		= require('../tools/tools.virsh.main.js');
var virshPool		= require('../tools/tools.virsh.pool.js');
var volume			= require('../tools/tools.virsh.volume.js');
var fs				= require('fs');
var mongojs 		= require('mongojs');
var secretModule	= require('../modules/module.virsh.secret.js')();

module.exports = {
	define: 					define,
	undefine:				undefine,
	state:					state,
	stateUpdate:			stateUpdate,
	list:						list,
	start:					start,
	destroy:					destroy,
	shutdown:				shutdown,
	poweroff:				destroy,
	reboot:					reboot,
	deleteDiskFiles: 		deleteDiskFiles,
	diskList:				diskList,
	vncAddress:				vncAddress,
	attachISO:				attachISO,
	ejectISO:				ejectISO,
	migrate: 				migrate
};

function migrate(details){
	var deferred = Q.defer();
	console.log(details);
	//fetchServerFromDB({id: details.server}).then(console.log);
	//tools.runLocalCommand("virsh dumpxml " + details.server).then(console.log);
	migrationGetTargetNode(details).
	then(migrationGetSourceNode).
	then(migrateAction).
	then(deferred.resolve).
	fail(deferred.reject);
	
	return deferred.promise;
}

function migrateAction(refObject){
	var deferred = Q.defer();
	var curCommand = "sudo -H -u "+ refObject.sourceNodeDetails.username +" bash -c 'virsh migrate "+ refObject.server +" qemu+ssh://"+ refObject.targetNodeDetails.hostnameshort +"/system --live --undefinesource' ";
	console.log(curCommand);
	tools.runLocalCommand(curCommand).then(console.log);
	deferred.resolve(refObject);
	return deferred.promise;
}

function migrationGetTargetNode(refObject){
	var deferred = Q.defer();
	tools.db.nodes.findOne({_id:mongojs.ObjectId(refObject.targetNode)}, function(err, targetNode){
		if(err){
			deferred.reject(err);
		} else {
			refObject.targetNodeDetails = targetNode;
			deferred.resolve(refObject);
		}
	});
	return deferred.promise;
}

function migrationGetSourceNode(refObject){
	var deferred = Q.defer();
	tools.db.nodes.findOne({_id:mongojs.ObjectId(refObject.sourceNode)}, function(err, sourceNode){
		if(err){
			deferred.reject(err);
		} else {
			refObject.sourceNodeDetails = sourceNode;
			deferred.resolve(refObject);
		}
	});
	return deferred.promise;
}

function start(cSrv){
	console.log("serverStart is called for:" + cSrv.id);
	var deferred = Q.defer();
	var theCommand = 'virsh start ' + cSrv.id;
	fetchServerFromDB(cSrv).
		then(state).
		then(writeDHCPItem).
		then(function(result) {
			cSrv = result;
			console.log("==================================");
			console.log("==================================");
			console.log(result);
			console.log("==================================");
			console.log(cSrv.domstate);
			console.log("==================================");
			if(cSrv.domstate == 'shut off'){
				console.log("==================================");
				console.log("Starting");
				console.log("==================================");
				console.log("==================================");
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

function fetchServerFromDB(cSrv){
	var deferred = Q.defer();
	tools.db.servers.findOne({_id: mongojs.ObjectId(cSrv.id)}, function(err, data){
		if(err){
			console.log("==================================");
			console.log(err);
			console.log("==================================");
			console.log("==================================");
			deferred.reject(err);
		} else {
			console.log("==================================");
			data.id = data._id.toString();
			deferred.resolve(data);
			console.log("Resolved");
			console.log("==================================");console.log("==================================");console.log("==================================");
		}
	});
	return deferred.promise;
}

function undefine(cSrv){
	tools.logger.info("serverDelete called for " + cSrv.id);
	var deferred = Q.defer();
	
	state(cSrv).
		then(deleteDHCPItem).
		then(destroy).
		then(checkDiskFiles).
		then(deleteDiskFiles).
		then(undefineVirsh).
		then( function(result){ 	tools.logger.info( "serverDelete succeeded for " + cSrv.id, cSrv);	deferred.resolve(cSrv);	}).
		fail( function(issue){ 		tools.logger.error("serverDelete failed for " + cSrv.id, cSrv);		deferred.reject(issue); 		});
	
	return deferred.promise;
}

function undefineVirsh(cSrv){
	tools.logger.info("serverUndefine is called", cSrv.id, true );
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

function deleteDiskFiles(cSrv){
	console.log("deleteDiskFiles is called",cSrv.id);
	tools.logger.info("serverDeleteDiskFiles is called", cSrv.id);
	var deferred = Q.defer();
	if(cSrv.domstate == 'notexist'){
		deferred.resolve(cSrv);
	} else {
		var theCmds = [];
		console.log("===================================================");
		console.log(cSrv);
		console.log("===================================================");
		cSrv.hdds.forEach(function(curDisk){
			console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
			console.log(curDisk);
			console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
			theCmds.push("virsh vol-delete --vol "+ curDisk.Source);
		});
		console.log(theCmds);
		
		tools.runLocalCommand(theCmds).
			then( function(result){ 	tools.logger.info( "serverDeleteDiskFiles succeeded for " + cSrv.id, result);	cSrv.serverDeleteDiskFilesResult = result; deferred.resolve(cSrv);	}).
			fail( function(issue){ 		tools.logger.error("serverDeleteDiskFiles failed for " + cSrv.id, issue);																deferred.reject(issue); 	});
	}
	return deferred.promise;
}

function checkDiskFiles(cSrv){
	tools.logger.info("serverCheckDiskFiles is called", cSrv.id, true);
	var deferred = Q.defer();
	
	if(cSrv.domstate == 'notexist'){
		tools.logger.info("checkDiskFiles succeeded for " + cSrv.id);
		deferred.resolve(cSrv);
	} else {
		diskList(cSrv).then(function(diskList){
			cSrv.hdds = [];
			diskList.forEach(function(curDisk){
				if(curDisk.Device == 'disk') cSrv.hdds.push(curDisk);
			});
			deferred.resolve(cSrv);
		}).fail(deferred.reject);
	}
	return deferred.promise;
}

function destroy(cSrv){
	tools.logger.info("serverDestroy called", cSrv.id, true);
	var deferred = Q.defer();
	if(cSrv.domstate == 'shut off'){
		tools.logger.info("serverDestroy succeeded for " + cSrv.id);
		deferred.resolve(cSrv);
	} else if(cSrv.domstate == 'notexist'){
		tools.logger.info("serverDestroy succeeded for " + cSrv.id);
		deferred.resolve(cSrv);
	} else {
		tools.runLocalCommand('virsh destroy '+cSrv.id).
			then( function(result){ 	tools.logger.info( "serverDestroy succeeded for " + cSrv.id, result); 	cSrv.serverDestroyResult = result; 		deferred.resolve(cSrv);		}).
			fail( function(issue){ 		tools.logger.error("serverDestroy failed for " + cSrv.id, issue);																deferred.reject(issue); 	});
	}
	return deferred.promise;
}

function reboot(cSrv){
	console.log("Server Reboot is called for:", cSrv.id);
	tools.logger.info("serverReboot is called for:"+cSrv.id);
	var deferred = Q.defer();
	var theCommand = 'virsh reboot ' + cSrv.id;
	state(cSrv).then(function(result) {
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

function shutdown(cSrv){
	tools.logger.info("server Shutdown is called for:" + cSrv.id);
	var deferred = Q.defer();
	var theCommand = 'virsh shutdown ' + cSrv.id;
	state(cSrv).then(function(result) {
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

function stateUpdate(cSrvID){
	list().then(function(result){
		result.forEach(function(curDom){
			if(curDom.Name == cSrvID){
				tools.db.servers.update({_id: mongojs.ObjectId(cSrvID)}, {$set: {status: curDom.State, domstate: curDom.State}}, function(err, data){
					if(err){
						console.log("Server Status update on db failed:",err);
					}
				});
			}
		});
		
	}).fail(console.log);
}

function state(cSrv){
	tools.logger.info("serverState called", cSrv.id, true);
	var deferred = Q.defer();
	list().then(
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

function list(){
	tools.logger.info("serverList is called");
	var deferred = Q.defer();
	tools.runLocalCommand('virsh list --all').then(function(result){ return returner.prepare(result, 'list') }).then(deferred.resolve).fail(deferred.reject);
	return deferred.promise;
}

function define(cSrv){
	var deferred = Q.defer();
	if(!cSrv.architecture) 														cSrv.architecture = 'x86_64';
	if(!cSrv.imageType) 															cSrv.imageType = 'qcow2';
	if(cSrv.netdriver != 'rtl8139' && cSrv.netdriver != 'e1000') 	cSrv.netdriver = 'virtio';
	if(cSrv.diskdriver != 'ide')												cSrv.diskdriver = 'virtio';
	if(!cSrv.bridge)																cSrv.bridge = 'br0';
	cSrv.newsize = 																cSrv.hdd;
	tools.logger.info("Defining Server " + cSrv.id, cSrv, true);
	
	writeDHCPItem(cSrv).
		then(virshMain.getMostAvailablePool).
		then(getServerPoolDetailsDB).
		then(secretModule.get).
		then(composeDomainXML).
		then(saveDomainXML).
		then(createDomainDiskFile).
		then(serverResize).
		then(createDomainandStart).
		then(deferred.resolve).
		fail(deferred.reject);

	return deferred.promise;
}

function writeDHCPItem(cSrv){
	var deferred = Q.defer();
	console.log("=============================================================writeDHCPItem");
	//killdnsmasq(cSrv).
	//then(writeDHCPItemAction).
	writeDHCPItemAction(cSrv).
	then(deferred.resolve).
	fail(deferred.reject);
	return deferred.promise;
}

function writeDHCPItemAction(cSrv){
	console.log("writeServerDHCPItem is called", cSrv);
	var deferred = Q.defer();
	var theCommands = [];
	var nameservers = [];
		if(cSrv.nameserver1) nameservers.push(cSrv.nameserver1);
		if(cSrv.nameserver2) nameservers.push(cSrv.nameserver2);
	var theContent  = 'host '+ cSrv.id + '{\n';
		theContent += '	hardware ethernet '+ cSrv.mac +';\n';
		theContent += '	option routers '+ cSrv.gateway +';\n';
		theContent += '	option subnet-mask '+ cSrv.netmask +';\n';
		theContent += '	fixed-address '+ cSrv.ip +';\n';
		theContent += '	option domain-name-servers '+ nameservers.join(',') +';\n';
		theContent += '}';
	
	theCommands.push('cd && echo "host '+ cSrv.id + '{" 														> dhcpd.conf.body.'+cSrv.id);
	theCommands.push('cd && echo "	hardware ethernet '+ cSrv.mac +';" 									>> dhcpd.conf.body.'+cSrv.id);
	theCommands.push('cd && echo "	option routers '+ cSrv.gateway +';" 								>> dhcpd.conf.body.'+cSrv.id);
	theCommands.push('cd && echo "	option subnet-mask '+ cSrv.netmask +';" 							>> dhcpd.conf.body.'+cSrv.id);
	theCommands.push('cd && echo "	fixed-address '+ cSrv.ip +';" 										>> dhcpd.conf.body.'+cSrv.id);
	theCommands.push('cd && echo "	option domain-name-servers '+ nameservers.join(',') +';" 	>> dhcpd.conf.body.'+cSrv.id);
	theCommands.push('cd && echo "}" >> dhcpd.conf.body.'+cSrv.id);
	tools.runLocalCommands(theCommands).
		then(virshMain.refreshDHCPConfig).
		then(function(result){
			console.log("====================================================================writeServerDHCPItem is succeeded", cSrv);
			deferred.resolve(cSrv);
		}).fail(function(issue){
			tools.logger.error("====================================================================writeServerDHCPItem is failed", issue, true);
			deferred.reject(issue);
		});
	return deferred.promise;
}

function deleteDHCPItem(cSrv){
	tools.logger.info("deleteDHCPItem is called", cSrv.id, true);
	var deferred = Q.defer();
	var theCommands = [];
	theCommands.push('cd && rm dhcpd.conf.body.'+cSrv.id);
	tools.runLocalCommands(theCommands).
		then(virshMain.refreshDHCPConfig).
		then(function(result){
			deferred.resolve(cSrv);
		}).fail(function(issue){
			if(issue.indexOf('No such file or directory') >= 0 ){
				deferred.resolve(cSrv);
			} else {
				deferred.reject(issue);
			}
		});
	return deferred.promise;
}

function getServerPoolDetailsDB(cSrv){
	var deferred = Q.defer();
	virshPool.getPoolDetailsDB(cSrv.store).
	then(function(poolDetails){
		cSrv.poolDetails = poolDetails;
		tools.logger.info("getServerPoolDetailsDB is successful", cSrv, true);
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function composeDomainXML(cSrv){
	tools.logger.info('composeDomainXML is called', cSrv);
	var deferred = Q.defer();
	cSrv.diskName = 'disk-' + cSrv.id + '-' + (cSrv.diskdriver == 'ide' ? 'hda' : 'vda');
	var theXML = ''
	+ 	'<domain type=\'kvm\'>'																														+ '\n'
	+ 	'	<name>'+ cSrv.id +'</name>'																											+ '\n'
	//  <uuid>e5c82363-ceea-74a2-a678-c05ab504c669</uuid>																					+ '\n'
	+ 	'	<description>'+ cSrv.name +'</description>'																						+ '\n'
	+ 	'	<memory unit=\'MiB\'>'+ cSrv.ram +'</memory>'																					+ '\n'
//	+ 	'	<maxMemory unit=\'MiB\' slots=\'16\'>'+ cSrv.ram +'</maxMemory>'															+ '\n'
//	+ 	'	<currentMemory unit=\'MiB\'>'+ cSrv.ram +'</currentMemory>'																	+ '\n'
	+ 	'	<vcpu placement=\'static\'>'+ cSrv.cpu +'</vcpu>'																				+ '\n'
	+ 	'	<cpu><topology sockets=\'1\' cores=\''+ cSrv.cpu +'\' threads=\'1\'/></cpu>'											+ '\n'
	+ 	'	<os>'																																			+ '\n'
	+ 	'		<type arch=\''+ cSrv.architecture +'\' machine=\'pc\'>hvm</type>'														+ '\n'
	+ 	'		<boot dev=\'hd\' />'																													+ '\n'
	+ 	'		<boot dev=\'cdrom\' />'																												+ '\n'
	+ 	'		<bootmenu enable=\'yes\' timeout=\'3000\' />'																				+ '\n'
	+ 	'	</os>'																																		+ '\n'
	+	'	<features><acpi /><apic /><pae /></features>'																					+ '\n'
	+	'	<clock sync=\'localtime\'/>'																											+ '\n'
	+	'	<on_poweroff>destroy</on_poweroff>'																									+ '\n'
	+	'	<on_reboot>restart</on_reboot>'																										+ '\n'
	+	'	<on_crash>restart</on_crash>'																											+ '\n'
	+	'	<devices>'																																	+ '\n'
	+	'		<disk type=\'network\' device=\'disk\'>'																						+ '\n'
	+	'			<driver name=\'qemu\' type=\'raw\' cache=\'writeback\' />'															+ '\n'
	+	'			<source protocol=\'rbd\' name=\''+cSrv.poolDetails.name+'/'+cSrv.diskName+'\'>'								+ '\n'
	+	'			</source>'																															+ '\n'
	+	'			<auth username=\''+cSrv.poolDetails.username+'\'>'																		+ '\n'
   +	'			     <secret type=\'ceph\' uuid=\''+cSrv.poolsecret+'\' />'															+ '\n'
	+	'			</auth>'																																+ '\n'
	+	'			<target dev=\''+ (cSrv.diskdriver == 'ide' ? 'hda' : 'vda') +'\' bus=\''+ cSrv.diskdriver +'\'/>'		+ '\n'
	+	'		</disk>'																																	+ '\n'
	+	'		<disk type=\'file\' device=\'cdrom\'><target dev=\'hdc\'/><readonly/></disk>'										+ '\n'
	+	'		<disk type=\'file\' device=\'cdrom\'><target dev=\'hdd\'/><readonly/></disk>'										+ '\n'
	+	'		<interface type=\'bridge\'>'																										+ '\n'
	+	'			<model type=\''+ cSrv.netdriver +'\' />'																					+ '\n'
	+	'			<source bridge=\''+ cSrv.bridge +'\'/>'																					+ '\n'
	//for below target dev we should find a proper naming mechanism
//	+	'			<target dev=\'kvm255.0\'/>'																									+ '\n'
	+	'			<mac address=\''+ cSrv.mac +'\'/>'																							+ '\n'
	+	'		</interface>'																															+ '\n'
	+	'		<input type=\'tablet\'/>'																											+ '\n'
	+	'		<input type=\'mouse\'/>'																											+ '\n'
	+	'		<graphics type=\'vnc\' port=\'-1\' autoport=\'yes\' passwd=\''+ cSrv.id +'\' listen=\'0.0.0.0\'/>'			+ '\n'
	+	'		<video><model type=\'vga\' vram=\'9216\' heads=\'1\'/></video>'														+ '\n'
	+	'	</devices>'																																	+ '\n'
	+ 	'</domain>';
	cSrv.theXML = theXML;
	tools.logger.info('composeDomainXML is completed with XML', cSrv.theXML, true);
	tools.logger.info('composeDomainXML is completed with XML, resulting status', cSrv, true);
	
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
	volume.create(cSrv.diskName, cSrv.store, cSrv.hdd, cSrv.imageType, cSrv.baseImage).
		then(function(result){ tools.logger.info('createDomainDiskFile succeeded', result); deferred.resolve(cSrv); }).
		fail(function( issue){ tools.logger.info('createDomainDiskFile failed   ', issue ); deferred.reject(issue); });
	
	return deferred.promise;
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
		vdaResize(cSrv).
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

function vdaResize(cSrv){
	var deferred = Q.defer();
	console.log("vdaResize start");
	volume.resize("disk-"+ cSrv.id +"-vda", cSrv.store, cSrv.newsize).then(function(result){
		console.log("vdaResize finish");
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function enableNBD(cSrv){
	var deferred = Q.defer();
	console.log(cSrv);
	if(cSrv.imageType == 'ceph'){
		deferred.resolve(cSrv);
		return deferred.promise;
	}
	var curCommand = 'sudo modprobe nbd max_part=63 nbds_max=64';
	tools.runLocalCommand(curCommand).then(function(result) {
		console.log("enableNBD Finish");
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function findFreeNBD(cSrv){
	var deferred = Q.defer();
	if(cSrv.imageType == 'ceph'){
		deferred.resolve(cSrv);
		return deferred.promise;
	}
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
			console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>Found free NBD", cSrv.targetNBD);
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

function lockFreeNBD(cSrv){
	var deferred = Q.defer();
	console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>We are at lockFreeNBD", cSrv.targetNBD);
	console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>Pool Details are as: ", cSrv.poolDetails.type);
	var curCommand = "sudo qemu-nbd -c "+ cSrv.targetNBD +" /mnt/luckynodepools/"+cSrv.store+"/disk-"+cSrv.id+"-vda.qcow2";
	if(cSrv.imageType == 'ceph'){
		curCommand = "sudo rbd map "+cSrv.poolDetails.name+"/"+cSrv.diskName+" -k /etc/ceph/ceph.client."+cSrv.poolDetails.username+".keyring --name client."+cSrv.poolDetails.username;
	}
	console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>Command is: ", curCommand);
	tools.runLocalCommand(curCommand).then(function(result){
		console.log("lockFreeNBD finish");
		cSrv.targetNBD = result.toString().trim();
		console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>Result is:", cSrv.targetNBD);
		deferred.resolve(cSrv);
	}).fail(function(issue){
		deferred.reject(issue);
	});
	return deferred.promise;
}

function describeNBD(cSrv){
	console.log("describeNBD", cSrv.id);
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
				curObj.realsize		= tools.size2realsize(curObj.size);
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
		cSrv.targetPartitionType = listDisks[curMaxDisk].filesystem;
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function resizeNBDPartition(cSrv){
	console.log("We are resizing NBD partition", cSrv.id);
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

function checkNBDFileSystem(cSrv){
	console.log("checkNBDFileSystem", cSrv.id);
	var deferred = Q.defer();
	var curCommand = "sudo e2fsck -p -f "+cSrv.targetNBD+"p"+cSrv.targetPartition;
	if(cSrv.targetPartitionType == 'ntfs') curCommand = "sudo ntfsfix "+cSrv.targetNBD+"p"+cSrv.targetPartition;
	console.log("=============================================================");
	console.log(curCommand);
	console.log("=============================================================");
	tools.runLocalCommand(curCommand).then(function(result){
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function resizeNBDFileSystem(cSrv){
	console.log("resizeNBDFileSystem", cSrv.id);
	var deferred = Q.defer();
	var curCommand = "sudo resize2fs "+cSrv.targetNBD+"p"+cSrv.targetPartition;
	if(cSrv.targetPartitionType == 'ntfs') curCommand = "sudo ntfsresize -ff "+cSrv.targetNBD+"p"+cSrv.targetPartition;
	console.log("=============================================================");
	console.log(curCommand);
	console.log("=============================================================");
	tools.runLocalCommand(curCommand).then(function(result){
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function releaseNBD(cSrv){
	console.log("releaseNBD", cSrv.id);
	console.log("releaseNBD============================================================");
	console.log("releaseNBD============================================================");
	console.log("releaseNBD============================================================");
	if(cSrv.imageType == 'ceph'){
		return releaseRBD(cSrv);
	}
	var deferred = Q.defer();
	getNBDPID(cSrv).then(function(result){
		if(cSrv.NBDPID > 0){
			var curCommand = "sudo kill -SIGTERM "+cSrv.NBDPID;
			tools.runLocalCommand(curCommand).then(function(result){
				console.log("releaseNBD==========================================================OK");
				console.log("releaseNBD==========================================================OK");
				console.log("releaseNBD==========================================================OK");
				deferred.resolve(cSrv);
			}).fail(deferred.reject);
		} else {
			console.log("releaseNBD==========================================================NOTHING");
			console.log("releaseNBD==========================================================NOTHING");
			console.log("releaseNBD==========================================================NOTHING");
			console.log("There is no NBD process attached to this server");
			deferred.resolve(cSrv);
		}
	}).fail(deferred.reject);
	return deferred.promise;
}

function releaseRBD(cSrv){
	var deferred = Q.defer();
	console.log("releaseRBD", cSrv.id);
	console.log("releaseRBD============================================================");
	console.log("releaseRBD============================================================");
	console.log("releaseRBD============================================================");
	var curCommand = "sudo rbd unmap "+cSrv.targetNBD;
	tools.runLocalCommand(curCommand).
	then(function(result){
		console.log("releaseRBD==========================================================OK");
		console.log("releaseRBD==========================================================OK");
		console.log("releaseRBD==========================================================OK");
		deferred.resolve(cSrv);
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
			if(result[i].indexOf(cSrv.id) >= 0){
				cSrv.NBDPID = tools.splitBySpace(result[i])[1];
			}
		}
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
	return deferred.promise;
}

function killdnsmasq(cSrv){
	var deferred = Q.defer();
	console.log("=============================================================killdnsmasq");
	getdnsmasqPID(cSrv).then(function(cSrv){
		if(cSrv.dmPID > 0){
			tools.runLocalCommand("sudo kill -SIGTERM "+cSrv.dmPID).then(function(result){
				deferred.resolve(cSrv);
			}).fail(deferred.reject);
		} else {
			deferred.resolve(cSrv);
		}
	}).fail(deferred.reject);
	return deferred.promise;
}

function getdnsmasqPID(cSrv){
	var deferred = Q.defer();
	console.log("=============================================================getdnsmasqPID");
	var curCommand = "ps aux";
	tools.runLocalCommand(curCommand).then(function(result) {
		result = result.trim().split('\n');
		cSrv.dmPID = 0;
		for(var i = 0; i < result.length; i++){
			if(result[i].indexOf("dnsmasq") >= 0){
				cSrv.dmPID = tools.splitBySpace(result[i])[1];
			}
		}
		console.log("=============================================================dnsmsqPID", cSrv.dmPID);
		deferred.resolve(cSrv);
	}).fail(deferred.reject);
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

function diskList(cSrv){
	tools.logger.info("serverDiskList is called for " + cSrv.id, cSrv);
	var deferred = Q.defer();
	tools.runLocalCommand('virsh domblklist '+ cSrv.id +' --details').then(
		function(result){
			console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
			console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
			console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
			console.log(result);
			console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
			console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
			console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
			
			var toReturn = [];
			
			returner.prepare(result,'domblklist').then(function(result){ 
				toReturn = result; 
				for(var i = 0; i < toReturn.length; i++){
					if(toReturn[i].Source.indexOf('/mnt/luckynodepools')>=0){
						toReturn[i].Store = toReturn[i].Source.replace("/mnt/luckynodepools/", '').split("/")[0];
					}
					toReturn[i].Name = toReturn[i].Source.split("/")[toReturn[i].Source.split("/").length-1];
				}
				
				tools.logger.info("serverDiskList succeeded for " + cSrv.id, toReturn);
				deferred.resolve(toReturn);
				
			}).fail(deferred.reject);
		}
	).fail( function(issue){ tools.logger.info("serverDiskList failed for " + cSrv.id, issue); deferred.reject(issue); } );
	return deferred.promise;
}

function vncAddress(cSrv){
	tools.logger.info("serverVNCAddress is called for:"+cSrv.id);
	var deferred = Q.defer();
	var theCommand = 'virsh vncdisplay ' + cSrv.id;
	state(cSrv).then(function(result){
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

function ejectISO(details){
	tools.logger.info("serverejectISO is called", details, true);
	var deferred = Q.defer();
	var theXML = '';
	theXML += "<disk type='file' device='cdrom'>\n";
	theXML += "	<source file='' />\n";
	theXML += "	<target dev='"+details.target+"' />\n";
	theXML += "	<readonly />\n";
	theXML += "</disk>\n";
	var poolDetails = {};
	poolDetails.xml = theXML;
	poolDetails.xmlloc = '/tmp/isomount-'+details.server+'-'+details.target+'.xml';
	saveISOXML(poolDetails).
	then(function(poolDetails){
		poolDetails.command = "virsh update-device --config "+ details.server +" " + poolDetails.xmlloc;
		var theCurDom = {id: details.server};
		state(theCurDom).then(function(result){
			if(theCurDom.domstate == 'running') poolDetails.command += ' --live';
			return tools.runLocalCommand(poolDetails.command);
		}).fail(deferred.reject);
	}).
	then(deferred.resolve).
	fail(deferred.reject);
	
	return deferred.promise;
}

function attachISO(details){
	tools.logger.info("serverAttachISO is called", details);
	var deferred = Q.defer();
	virshPool.getPoolDetailsDB(details.pool).
	then(secretModule.list).
	then(function(poolDetails){
		var selectedUUID = '';
		poolDetails.secretList.forEach(function(curSecret){
			console.log(curSecret, poolDetails.username);
			if(curSecret.Usage == 'ceph client.'+poolDetails.username+' secret') selectedUUID = curSecret.UUID;
		});
		poolDetails.secretList.forEach(function(curSecret){
			console.log(curSecret, poolDetails.username);
			if(curSecret.Usage == 'ceph '+poolDetails.name+' secret') selectedUUID = curSecret.UUID;
		});
		var theXML = '';
		theXML += "<disk type='network' device='cdrom'>\n";
		theXML += "	<source protocol='rbd' name='"+poolDetails.name+"/"+details.iso+"' />\n";
		theXML += "	<target dev='"+details.target+"' />\n";
		theXML += "	<readonly />\n";
		theXML += "	<driver name='qemu' type='raw' />\n";
		theXML += "	<auth username='"+poolDetails.username+"'>\n";
		theXML += "		<secret type='ceph' uuid='"+selectedUUID+"' />\n";
		theXML += "	</auth>\n";
		theXML += "</disk>\n";
		console.log("theXML<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
		console.log("Details:", details);
		console.log("PoolDetails:", poolDetails);
		console.log("SelectedUUID:", selectedUUID);
		console.log(theXML);
		console.log("theXML<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
		poolDetails.xml = theXML;
		poolDetails.xmlloc = '/tmp/isomount-'+details.server+'-'+details.target+'.xml';
		return saveISOXML(poolDetails);
	}).
	then(function(poolDetails){
		poolDetails.command = "virsh update-device --config "+ details.server +" " + poolDetails.xmlloc;
		var theCurDom = {id: details.server};
		state(theCurDom).then(function(result){
			if(theCurDom.domstate == 'running') poolDetails.command += ' --live';
			return tools.runLocalCommand(poolDetails.command);
		}).fail(deferred.reject);
	}).
	then(deferred.resolve).
	fail(deferred.reject);
	
	return deferred.promise;
}
 
function saveISOXML(details){
	var deferred = Q.defer();
	var fs = require('fs');
	fs.writeFile(details.xmlloc, details.xml, function(err) {
		if (err){
			deferred.reject(err);
		} else {
			tools.logger.info("XML file for the cdrom " + details.xmlloc + " is saved.", details, true);
			deferred.resolve(details);
		}
	});
	return deferred.promise;
}