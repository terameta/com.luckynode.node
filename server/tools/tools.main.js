var Q				= require('q');
var bcrypt   		= require('bcrypt-nodejs');
var jwt				= require('jsonwebtoken');
var config 			= require('../config/config.main.js');
var exec 			= require('child_process').exec;
var fs 				= require("fs");
var mongojs 		= require('mongojs');

var whoami			= JSON.parse(fs.readFileSync('whoami.conf', 'utf8')).whoami;

var dbconfig;

try {
	dbconfig = JSON.parse(fs.readFileSync("dbconf.conf", "utf8"));
	console.log("dbconfig exists");
}
catch (err) {
	console.log("dbconfig doesn't exist");
	// If the type is not what you want, then just throw the error again.
	var curManagers = fs.readFileSync('managerip', "utf-8").trim().split(',');
	if (err.code !== 'ENOENT') throw err;
	console.log(curManagers);
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

console.log("We are bede");

var cloudConnStr	= dbconfig.user+':'+dbconfig.pass+'@'+dbconfig.server+':'+dbconfig.port+'/'+dbconfig.database;
var cloudColls		= ['logs'];
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
		toReturn += ('0' + (parseInt(curDate.getMonth()) + 1)).substr(-2);
		toReturn += ('0' + (parseInt(curDate.getDate()))).substr(-2);
		toReturn += ('0' + (parseInt(curDate.getHours()))).substr(-2);
		toReturn += ('0' + (parseInt(curDate.getMinutes()))).substr(-2);
		toReturn += ('0' + (parseInt(curDate.getSeconds()))).substr(-2);
		return toReturn;
	},
	jwt : jwt,
	sendHTTPSRequest : sendHTTPSRequest,
	logger: logger,
	waitWithServer: waitWithServer
};

function waitWithServer(cSrv){
	var deferred = Q.defer();
	setTimeout(function(){
		deferred.resolve(cSrv);
	}, cSrv.waitTime);
	return deferred.promise;
}

function runLocalCommands(commandList){
	logger.info("runLocalCommands called", commandList);
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
			logger.error("runLocalCommand failed", command);
			deferred.reject(stderr);
		} else {
			logger.info("runLocalCommand succeeded", command);
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