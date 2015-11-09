var Q				= require('q');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');
var virshMain		= require('../tools/tools.virsh.main.js');

module.exports = {
	define: define
};

function define(cSrv){
	var deferred = Q.defer();
	if(!cSrv.architecture) 											cSrv.architecture = 'x86_64';
	if(!cSrv.imageType) 											cSrv.imageType = 'qcow2';
	if(cSrv.netdriver != 'rtl8139' && cSrv.netdriver != 'e1000') 	cSrv.netdriver = 'virtio';
	if(cSrv.diskdriver != 'ide')									cSrv.diskdriver = 'virtio';
	if(!cSrv.bridge)												cSrv.bridge = 'br0';
	cSrv.newsize = cSrv.hdd;
	tools.logger.info("Defining Server " + cSrv.id, cSrv, true);
	
	writeDHCPItem(cSrv).
		then(virshMain.getMostAvailablePool).
		then(composeDomainXML).
		then(saveDomainXML).
		//then(createDomainDiskFile).
		//then(serverResize).
		//then(createDomainandStart).
		then(deferred.resolve).
		fail(deferred.reject);

	return deferred.promise;
}

function writeDHCPItem(cSrv){
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
		then(virshMain.refreshDHCPConfig).
		then(function(result){
			tools.logger.info("writeServerDHCPItem is succeeded", result);
			deferred.resolve(cSrv);
		}).fail(function(issue){
			tools.logger.error("writeServerDHCPItem is failed", issue);
			deferred.reject(issue);
		});
	return deferred.promise;
}

function deleteDHCPItem(cSrv){
	tools.logger.info("writeServerDHCPItem is called");
	var deferred = Q.defer();
	var theCommands = [];
	theCommands.push('cd && rm dhcpd.conf.body.'+cSrv.id);
	tools.runLocalCommands(theCommands).
		then(refreshDHCPConfig).
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

function composeDomainXML(cSrv){
	tools.logger.info('composeDomainXML is called', cSrv);
	var deferred = Q.defer();
	var diskFile = '/mnt/luckynodepools/'+ cSrv.store +'/'+ 'disk-'+ cSrv.id +'-'+ (cSrv.diskdriver == 'ide' ? 'hda' : 'vda') +(cSrv.imageType == 'qcow2' ? '.qcow2' : '.img');
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
	+	'		<disk type=\'file\' device=\'disk\'>'																							+ '\n'
	+	'			<driver name=\'qemu\' type=\''+ cSrv.imageType +'\' cache=\'none\' />'											+ '\n'
	+	'			<source file=\''+ diskFile +'\' />'																							+ '\n'
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