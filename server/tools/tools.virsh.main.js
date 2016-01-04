var Q				= require('q');
var tools			= require('../tools/tools.main.js');
var returner		= require('../tools/tools.virsh.returner.js');
var mongojs			= require('mongojs');

module.exports = {
	getMostAvailablePool: 	getMostAvailablePool,
	refreshDHCPConfig:		refreshDHCPConfig,
	nodeInterfaceList:		nodeInterfaceList
};

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
			tools.db.servers.update({_id:mongojs.ObjectId(cSrv.id)}, {$set:{store:cSrv.store}}, function(err, data){
				tools.logger.info("Defining store for the server", cSrv.store);
				if(err){
					tools.logger.error("Defining store for the server failed", cSrv.store);
				}
			});
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
		theCommands.push('cd && echo "subnet 0.0.0.0 netmask 0.0.0.0 {authoritative;default-lease-time 21600000;max-lease-time 432000000;}" > dhcpd.conf.head');
		theCommands.push('cd && echo "ddns-update-style none;" >> dhcpd.conf.head');
		theCommands.push('cd && echo " " > dhcpd.conf.body.0');
		theCommands.push('cd && echo " " > dhcpd.conf.body.1');
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