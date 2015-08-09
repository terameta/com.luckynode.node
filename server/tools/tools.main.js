var Q				= require('q');
var bcrypt   		= require('bcrypt-nodejs');
var jwt				= require('jsonwebtoken');
var config 			= require('../config/config.main.js');
var exec 			= require('child_process').exec;

module.exports = {
	runLocalCommand: function(command, errorToDiscard){
		var deferred = Q.defer();
		exec(command, function(error, stdout, stderr){
			if(error){
				if(errorToDiscard == stderr){
					console.log("Error being discarded");
					deferred.resolve("Discarded error: "+ stderr);
				} else {
					console.log("Error is not discarded");
					console.log(">>>>>>>>>>>", errorToDiscard, "|||");
					console.log(">>>>>>>>>>>", stderr, "|||");
					console.log(error);
					console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
					deferred.reject(stderr);
				}
			} else {
				deferred.resolve(stdout);
			}
		});
		return deferred.promise;
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
