var Q				= require('q');
var bcrypt   		= require('bcrypt-nodejs');
var jwt				= require('jsonwebtoken');
var config 			= require('../config/config.main.js');
var exec 			= require('child_process').exec;

module.exports = {
	splitBySpace: function(source){
		return source.trim().split(/[\s,]+/);
	},
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
	jwt : jwt

};

function runLocalCommands(commandList){
	var deferred = Q.defer();
	if(commandList.length > 0){
		var curCommand = commandList.shift();
		runLocalCommand(curCommand).then(
			function(){
				deferred.resolve(runLocalCommands(commandList));
			}
		).fail(deferred.reject);
	} else {
		deferred.resolve();
	}
	
	return deferred.promise;
}

function runLocalCommand(command, resolveTo){
	var deferred = Q.defer();
	exec(command, function(error, stdout, stderr){
		if(error){
			deferred.reject(stderr);
		} else {
			if(resolveTo){
				deferred.resolve(resolveTo);
			} else {
				deferred.resolve(stdout);
			}
		}
	});
	return deferred.promise;
}