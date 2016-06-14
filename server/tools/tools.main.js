var Q				= require('q');
var bcrypt   		= require('bcrypt-nodejs');
var jwt				= require('jsonwebtoken');
var config 			= require('../config/config.main.js');
var exec 			= require('child_process').exec;
var spawn			= require('child_process').spawn;
var fs 				= require("fs");
var mongojs 		= require('mongojs');

var whoami			= JSON.parse(fs.readFileSync('whoami.conf', 'utf8'));
var whoamid			= whoami.whoamid;
	whoami			= whoami.whoami;

var dbconfig;
var curManagers;

try {
	
	//console.log(fs.readdirSync('./'));
	//console.log("we are currently here");
	//console.log(fs.readFileSync("dbconf.conf", "utf8"));
	dbconfig = JSON.parse(fs.readFileSync("./dbconf.conf", "utf8"));
	//console.log("we are currently here too");
	//console.log("dbconfig exists");
}
catch (err) {
	console.log("dbconfig doesn't exist for tools.main.js");
	// If the type is not what you want, then just throw the error again.
	curManagers = fs.readFileSync('managerip', "utf-8").trim().split(',');
	console.log(curManagers);
	if (err.code !== 'ENOENT') throw err;
	console.log(curManagers);
	console.log("We are here now");
	sendHTTPSRequest(curManagers[0], '/api/getDBConfigForNode', false).then(function(result){
		console.log("We are here:", result);
		fs.writeFileSync("dbconf.conf", result, "utf-8");
		console.log("Database config is received, we will now restart the system");
		process.exit(1);
	}).fail(function(issue){
		console.log("Failed to receive database config", issue);
		process.exit(1);
	});
	// Handle a file-not-found error aa
}

//console.log(dbconfig);
var cloudConnStr	= dbconfig.connstr;
var cloudColls		= ['logs', 'servers', 'nodes', 'nodecs', 'storages'];
var db 				= mongojs(cloudConnStr, cloudColls, { authMechanism : 'ScramSHA1' });

var logger = {
	log: function(level, message, metadata, shouldLogToConsole){
		if(shouldLogToConsole){
			console.log("Level:", level);
			console.log("Message:", message);
			if(metadata) console.log(metadata);
		}
		db.logs.insert({level:level, message:message, date: new Date(), metadata:metadata, origin:whoami}, function(err, data){
			if(err){
				console.log("Houston we have a problem", err);
				console.log(level);
				console.log(message);
				console.log(metadata);
			}
		});
	},
	info: 	function(message, metadata, shouldLogToConsole){ this.log('info', 	message, metadata, shouldLogToConsole); },
	warn: 	function(message, metadata, shouldLogToConsole){ this.log('warn', 	message, metadata, shouldLogToConsole); },
	error:	function(message, metadata, shouldLogToConsole){ this.log('error', 	message, metadata, shouldLogToConsole); }
};

module.exports = {
	whoami: whoami,
	whoamid: whoamid,
	db: db,
	size2realsize: size2realsize,
	splitBySpace: function(source){
		return source.trim().split(/[\s,]+/);
	},
	unfortunateWaiter:unfortunateWaiter,
	runLocalCommand: runLocalCommand,
	runLocalCommands: runLocalCommands,
	runIfLocalCommand: function(command, resolveTo, ifStat){
		if(!ifStat){
			var deferred = Q.defer();
			if(resolveTo){
				deferred.resolve(resolveTo);
			} else {
				deferred.resolve("No need to run this command");
			}
			return deferred.promise;
		} else {
			return runLocalCommand(command);
		}
	},
	checkToken : function (req, res, next) {
		var token = req.headers['x-access-token'];
		if (token) {
			jwt.verify(token, config.secret, function(err, decoded) {
				if (err) {
					return res.json({
						status: 'fail',
						message: 'Failed to authenticate token.'
					});
				}
				else {
					req.decoded = decoded;
					next();
				}
			});

		}
		else {
			return res.status(401).send({
				success: false,
				message: 'No token provided.'
			});

		}
	},
	generateHash : function(password) {
		return bcrypt.hashSync(password, bcrypt.genSaltSync(8));
	},compareHash : function(password, theHash) {
		return bcrypt.compareSync(password, theHash);
	},getFormatDate : function(curDate) {
		var toReturn = curDate.getFullYear();
		toReturn += ('0' + (parseInt(curDate.getMonth(), 10) + 1)).substr(-2);
		toReturn += ('0' + (parseInt(curDate.getDate(), 10))).substr(-2);
		toReturn += ('0' + (parseInt(curDate.getHours(), 10))).substr(-2);
		toReturn += ('0' + (parseInt(curDate.getMinutes(), 10))).substr(-2);
		toReturn += ('0' + (parseInt(curDate.getSeconds(), 10))).substr(-2);
		return toReturn;
	},
	jwt : jwt,
	sendHTTPSRequest : sendHTTPSRequest,
	logger: logger,
	waitWithServer: waitWithServer,
	getUserHome: getUserHome,
	getNodes: getNodes
};

function getUserHome() {
	return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function getNodes(){
	if(!curManagers) curManagers = fs.readFileSync('managerip', "utf-8").trim().split(',');
	if(!curManagers){
		logger.error("We can't read managerip file",null, true);
	} else if(curManagers.length < 1){
		logger.error("There is no manager recorded in the managerip file");
	} else {
		//console.log("We will now get nodes from the first manager", curManagers[0]);
		//runLocalCommand("ls -a "+getUserHome()).then(console.log);
		defineSSH();
	}
	//console.log("AAA",curManagers);
}

function defineSSH(){
	var refObject = {};
	checkSSHFolder(refObject).
	then(createSSHFolder).
	then(checkSSHKeys).
	then(createSSHKeys).
	then(readSSHPubKey).
	then(uploadPubKey).
	then(downloadNodeDetails).
	then(readLocalPubKeys).
	then(writeLocalPubKeys).
	then(uploadHostNames).
	then(readLocalSSHConfig).
	then(writeLocalSSHConfig).
	fail(function(issue){ logger.error("We can't define SSH files",issue, true);});
	
	function writeLocalSSHConfig(refObject){
		var deferred = Q.defer();
		console.log(refObject.localconfig);
		console.log(refObject.configFileItems);
		for(var i = 0; i < refObject.configFileItems.length; i++){
			var doWeHave = false;
			refObject.localconfig.forEach(function(curLocalConfig){
				if(curLocalConfig == "Host "+refObject.configFileItems[i].hostnameshort) doWeHave = true;
			});
			if(!doWeHave){
				var curCommands = [];
				curCommands.push("echo 'Host "+ 			refObject.configFileItems[i].hostnameshort	+ "' >> " + getUserHome() + "/.ssh/config");
				curCommands.push("echo '	Hostname "+ 	refObject.configFileItems[i].ip 			+ "' >> " + getUserHome() + "/.ssh/config");
				curCommands.push("echo '	User "+ 		refObject.configFileItems[i].user			+ "' >> " + getUserHome() + "/.ssh/config");
				curCommands.push("echo '	Port 14422"													+ "' >> " + getUserHome() + "/.ssh/config");
				curCommands.push("echo '	StrictHostKeyChecking no"									+ "' >> " + getUserHome() + "/.ssh/config");
				writeLocalSSHConfigAction(curCommands, i);
			}
		}
		deferred.resolve(refObject);
		return deferred.promise;
	}
	
	function writeLocalSSHConfigAction(commands, timer){
		setTimeout(function(){
			console.log(commands);
			runLocalCommands(commands);
		}, timer * 1000);
	}
	
	function readLocalSSHConfig(refObject){
		var deferred = Q.defer();
		fs.readFile(getUserHome()+"/.ssh/config", "utf-8", function(err, data){
			if(err){
				refObject.localconfig = [];
				deferred.resolve(refObject);
			} else {
				refObject.localconfig = data.trim().split('\n');
				deferred.resolve(refObject);
			}
		});
		return deferred.promise;
	}
	
	function uploadHostNames(refObject){
		var deferred = Q.defer();
		runLocalCommand("hostname").then(function(result){
			refObject.hostnamelong = result.toString().trim();
			return runLocalCommand("hostname -s");
		}).then(function(result){
			refObject.hostnameshort = result.toString().trim();
			db.nodes.update({_id: mongojs.ObjectId(whoamid)},{$set: {hostnamelong: refObject.hostnamelong, hostnameshort: refObject.hostnameshort}}, function(err, result){
				if(err){
					deferred.reject(err);
				} else {
					deferred.resolve(refObject);
				}
			});
		});
		return deferred.promise;
	}
	
	function writeLocalPubKeys(refObject){
		var deferred = Q.defer();
		var promises = [];
		for(var i = 0; i < refObject.nodeKeys.length; i++){
			var doWeHave = false;
			refObject.localkeys.forEach(function(curLocalKey){
				if(curLocalKey == refObject.nodeKeys[i]) doWeHave = true;
			});
			var curCommand = "echo '" + refObject.nodeKeys[i] + "' >> " + getUserHome() + "/.ssh/authorized_keys";
			if(!doWeHave) writeLocalKeyAction(curCommand, i);
			//console.log(i, doWeHave, refObject.nodeKeys[i]);
			//console.log(curCommand);
		}
		//console.log(refObject.localkeys);
		Q.all(promises).then(function(results){ deferred.resolve(refObject);}).fail(deferred.reject);
		return deferred.promise;
	}
	
	function writeLocalKeyAction(command, timer){
		var deferred = Q.defer();
		setTimeout(function(){
			runLocalCommand(command).then(deferred.resolve).fail(deferred.reject);
		}, timer*1000);
		return deferred.promise;
	}
	
	function readLocalPubKeys(refObject){
		var deferred = Q.defer();
		fs.readFile(getUserHome()+"/.ssh/authorized_keys", "utf-8", function(err, data){
			if(err){
				refObject.localkeys = [];
				deferred.resolve(refObject);
			} else {
				refObject.localkeys = data.trim().split('\n');
				deferred.resolve(refObject);
			}
		});
		return deferred.promise;
	}
	
	function downloadNodeDetails(refObject){
		var deferred = Q.defer();
		db.nodes.find(function(err, nodes){
			if(err){
				deferred.reject(err);
			} else {
				refObject.nodeKeys = [];
				refObject.configFileItems = [];
				nodes.forEach(function(curNode){
					refObject.nodeKeys.push(curNode.pubkey);
					refObject.configFileItems.push({
						ip: curNode.ip, 
						hostnamelong: curNode.hostnamelong,
						hostnameshort: curNode.hostnameshort,
						user: curNode.username
					});
				});
				deferred.resolve(refObject);
			}
		});
		return deferred.promise;
	}
	
	function uploadPubKey(refObject){
		var deferred = Q.defer();
		var curUser = process.env.USER;
		if(process.env.SUDO_USER) curUser = process.env.SUDO_USER;
		curUser = curUser.toString().trim();
		db.nodes.update({_id: mongojs.ObjectId(whoamid)},{$set: {pubkey: refObject.pubkey, username: curUser}}, function(err, result){
			if(err){
				deferred.reject(err);
			} else {
				deferred.resolve(refObject);
			}
		});
		return deferred.promise;
	}
	
	function readSSHPubKey(refObject){
		var deferred = Q.defer();
		refObject.pubkey = fs.readFileSync(getUserHome()+"/.ssh/id_rsa.pub", "utf-8").toString().trim();
		deferred.resolve(refObject);
		return deferred.promise;
	}
	
	function createSSHKeys(refObject){
		var deferred = Q.defer();
		if(refObject.doWeHaveSSHKeys){
			deferred.resolve(refObject);
		} else {
			runLocalCommand("ssh-keygen -t rsa -N '' -f "+getUserHome()+"/.ssh/id_rsa -q").then(function(){
				refObject.doWeHaveSSHKeys = true;
				deferred.resolve(refObject);
			}).fail(deferred.reject);
		}
		return deferred.promise;
	}
	
	function checkSSHKeys(refObject){
		var deferred = Q.defer();
		refObject.doWeHaveSSHKeys = false;
		var keyFiles = fs.readdirSync(getUserHome()+"/.ssh");
		keyFiles.forEach(function(curFile){
			if(curFile == 'id_rsa') refObject.doWeHaveSSHKeys = true;
		});
		deferred.resolve(refObject);
		return deferred.promise;
	}
	
	function createSSHFolder(refObject){
		var deferred = Q.defer();
		if(refObject.doWeHaveSSHFolder){
			deferred.resolve(refObject);
		} else {
			var curUser = process.env.USER;
			if(process.env.SUDO_USER) curUser = process.env.SUDO_USER;
			curUser = curUser.toString().trim();
			var commands = [];
			commands.push("mkdir "+getUserHome()+"/.ssh");
			commands.push("chown "+ curUser +"."+getUserHome()+"/.ssh");
			runLocalCommand("mkdir "+getUserHome()+"/.ssh").then(function(){
				refObject.doWeHaveSSHFolder = true;
				deferred.resolve(refObject);
			}).fail(deferred.reject);
		}
		return deferred.promise;
	}
	
	function checkSSHFolder(refObject){
		var deferred = Q.defer();
		refObject.doWeHaveSSHFolder = false;
		var homeFolders =fs.readdirSync(getUserHome());
		homeFolders.forEach(function(curFolder){
			if(curFolder == '.ssh') refObject.doWeHaveSSHFolder = true;
		});
		deferred.resolve(refObject);
		return deferred.promise;
	}
}

function waitWithServer(cSrv){
	var deferred = Q.defer();
	setTimeout(function(){
		deferred.resolve(cSrv);
	}, cSrv.waitTime);
	return deferred.promise;
}

function runLocalCommands(commandList){
	logger.info("runLocalCommands called", commandList, true);
	var deferred = Q.defer();
	if(commandList.length > 0){
		var curCommand = commandList.shift();
		runLocalCommand(curCommand).then(
			function(){
				runLocalCommands(commandList).then(
					function(result){
						deferred.resolve(result);
					}
				).fail(
					function(issue){
						deferred.reject(issue);
					}
				);
			}
		).fail(
			function(issue){ 
				deferred.reject(issue); 
			}
		);
	} else {
		deferred.resolve('');
	}
	
	return deferred.promise;
}

function runLocalCommand(command, resolveTo){
	var deferred = Q.defer();
	logger.info("runLocalCommand called", command);
	exec(command, function(error, stdout, stderr){
		if(error){
			logger.error("runLocalCommand failed", command + '\n' + error + '\n' + stdout + '\n' + stderr);
			console.log("runLocalCommand failed");
			console.log("error", error);
			console.log("stdout", stdout);
			console.log("stderr", stderr);
			deferred.reject(stderr);
		} else {
			logger.info("runLocalCommand succeeded", command, false);
			if(resolveTo){
				deferred.resolve(resolveTo);
			} else {
				deferred.resolve(stdout);
			}
		}
	});
	return deferred.promise;
}

function unfortunateWaiter(time){
    var stop = new Date().getTime();
    console.log("starting wait");
    while(new Date().getTime() < stop + time) {
        ;
    }
    console.log("completed wait");
}

function sendHTTPSRequest(host, path, shouldReject){
	var deferred = Q.defer();
	
	var http = require('https');
	var options = { host: host, path: path, rejectUnauthorized:shouldReject };
	
	var callback = function(response) {
		var str = '';
	
		//another chunk of data has been recieved, so append it to `str`
		response.on('data', function(chunk) {
			str += chunk;
		});
	
		//the whole response has been recieved, so we just print it out here
		response.on('end', function() {
			deferred.resolve(str);
		});
	};
	
	http.request(options, callback).on('error', function(e) {
	  deferred.reject('problem with request: ' + e.message);
	}).end();
	
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