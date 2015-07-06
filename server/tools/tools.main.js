var bcrypt   		= require('bcrypt-nodejs');
var jwt				= require('jsonwebtoken');
var config 			= require('../config/config.main.js');

module.exports = {
	checkToken : function (req, res, next) {
		var token = req.body.token || req.query.token || req.headers['x-access-token'];
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
