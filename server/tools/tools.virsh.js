var Q				= require('q');
//var config 			= require('../config/config.main.js');
var tools			= require('../tools/tools.main.js');

module.exports = {
	poolList: poolList,
	poolsDefine: poolsDefine,
	poolDefine: poolDefine,
	poolsRemove: poolsRemove,
	poolRemove: poolRemove,
	serverDefine:serverDefine
};

function serverDefine(cSrv){
	var deferred = Q.defer();
	console.log("=====================================");
	console.log(cSrv);
	console.log("=====================================");
	if(!cSrv.architecture) 	cSrv.architecture = 'x86_64';
	if(!cSrv.imageType) 	cSrv.imageType = 'qcow2';
	
	var theXML = ''
	+ 	'<domain type=\'kvm\'>'																					+ '\n'
	+ 	'	<name>'+ cSrv.id +'</name>'																			+ '\n'
	//  <uuid>e5c82363-ceea-74a2-a678-c05ab504c669</uuid>														+ '\n'
	+ 	'	<description>'+ cSrv.name +'</description>'															+ '\n'
	+ 	'	<memory unit=\'MiB\'>'+ cSrv.ram +'</memory>'														+ '\n'
	+ 	'	<vcpu placement=\'static\'>'+ cSrv.cpu +'</vcpu>'													+ '\n'
	+ 	'	<cpu><topology sockets=\'1\' cores=\''+ cSrv.cpu +'\' threads=\'1\'/></cpu>'						+ '\n'
	+ 	'	<os>'																								+ '\n'
	+ 	'		<type arch=\''+ cSrv.architecture +'\' machine=\'pc\'>hvm</type>'								+ '\n'
	+ 	'		<boot dev=\'hd\' />'																			+ '\n'
	+ 	'		<boot dev=\'cdrom\' />'																			+ '\n'
	+ 	'		<bootmenu enable=\'yes\' timeout=\'3000\' />'													+ '\n'
	+ 	'	</os>'																								+ '\n'
	+	'	<features><acpi /><apic /><pae /></features>'														+ '\n'
	+	'	<clock sync=\'localtime\'/>'																		+ '\n'
	+	'	<on_poweroff>destroy</on_poweroff>'																	+ '\n'
	+	'	<on_reboot>restart</on_reboot>'																		+ '\n'
	+	'	<on_crash>restart</on_crash>'																		+ '\n'
	+	'	<devices>'																							+ '\n'
	+	'		<disk type=\'file\' device=\'disk\'>'															+ '\n'
	+	'			<driver name=\'qemu\' type=\''+ cSrv.imageType +'\' cache=\'none\' />'						+ '\n'
	+	'			<source file=\'/mnt/luckynodepools/store0/deneme.qcow2\' />'								+ '\n'
	+	'			<target dev=\'vda\' bus=\'virtio\'/>'														+ '\n'
	// if ide use this +	'			<target dev=\'hda\' bus=\'ide\'/>'										+ '\n'
	+	'		</disk>'																						+ '\n'
	+	'		<disk type=\'file\' device=\'cdrom\'><target dev=\'hdc\'/><readonly/></disk>'					+ '\n'
	+	'		<interface type=\'bridge\'>'																	+ '\n'
	// if other driver we should write e1000 or stg
	+	'			<model type=\'virtio\' />'																	+ '\n'
	+	'			<source bridge=\'br0\'/>'																	+ '\n'
	//for below target dev we should find a proper naming mechanism
//	+	'			<target dev=\'kvm255.0\'/>'																	+ '\n'
	+	'			<mac address=\''+ cSrv.mac +'\'/>'															+ '\n'
	+	'		</interface>'																					+ '\n'
	+	'		<input type=\'tablet\'/>'																		+ '\n'
	+	'		<input type=\'mouse\'/>'																		+ '\n'
	+	'		<graphics type=\'vnc\' port=\'-1\' autoport=\'yes\' passwd=\'Xw2oACxc\' listen=\'0.0.0.0\'/>'	+ '\n'
	//We should eventually control the vnc ports
// 	+	'		<graphics type=\'vnc\' port=\'5901\' autoport=\'yes\' passwd=\'Xw2oACxc\' listen=\'0.0.0.0\'/>'	+ '\n'
	+	'		<video><model type=\'vga\' vram=\'9216\' heads=\'1\'/></video>'									+ '\n'
	+	'	</devices>'																							+ '\n'
	+ 	'</domain>';
	console.log(theXML);
	var fs = require('fs');
	fs.writeFile('/tmp/'+cSrv.id+'.xml', theXML, function(err) {
		if (err){
			console.log(err);
		} else {
			var theCmds = [];
			//theCmds.push('virsh define /tmp/'+cSrv.id+'.xml');
			//theCmds.push('virsh start '+cSrv.id);
			tools.runLocalCommands(theCmds).
				then(function(result){
					deferred.resolve(result);
				}).
				fail(function(issue){
					deferred.reject(issue);
				});
		}
	});
	
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