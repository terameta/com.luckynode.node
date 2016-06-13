var Q			= require('q');
var config 		= require('../config/config.main.js');
var jwt			= require('jsonwebtoken');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	function sendToken(ip, res){
		var token = tools.jwt.sign(ip, app.get('jwtsecret'), {
			expiresInMinutes: 60*24*30 // expires in 30 days
		});
		res.json({
			status: 'success',
			message: 'Enjoy your token!',
			token: token
		});
	}
	
	function simplifyIP(ip){
		return ip.replace("::ffff:", "").replace("::FFFF:", "");
	}
	
	apiRoutes.get('/verifytoken', function(req, res){
		var token = req.headers['x-access-token'];
		
		if (token) {
			jwt.verify(token, config.secret, function(err, decoded) {
				if (err) {
					res.status(401).json({
						status: 'fail',
						message: 'Failed to authenticate token.'
					});
				}
				else {
					res.send('ok');
				}
			});

		}
		else {
			res.status(401).send({
				status: 'fail',
				message: 'No token provided.'
			});

		}
	});

	apiRoutes.get('/authenticate', function(req, res) {
		var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
		ip = simplifyIP(ip);
		var shouldAuth = false;
		var isTokenSent = false;
		
		var curManagers = app.get('managers');
		if(curManagers){
			curManagers.forEach(function(curManager){
				curManager = simplifyIP(curManager);
				if(curManager == ip){
					shouldAuth = true;
					isTokenSent = true; sendToken(ip, res);
				}
			});
		}
		if(shouldAuth) return 0;
		if(!shouldAuth && curManagers.length > 0){
			tools.sendHTTPSRequest(curManagers[0], '/api/getManagers', false).then(
				function(result){
					var listofIPs = JSON.parse(result);
					listofIPs.forEach(function(curManager){
						curManager = curManager.replace("::ffff:", "").replace("::FFFF:", "");
						if(curManager == ip){
							shouldAuth = true;
							if(!isTokenSent){ isTokenSent = true; sendToken(ip, res);}
							return 0;
						}
					});
					if(!shouldAuth){
						var promises = [];
						listofIPs.forEach(function(curManager){
							curManager = curManager.replace("::ffff:", "").replace("::FFFF:", "");
							var curPromise = tools.sendHTTPSRequest(curManager, '/api/getMyIPs', false);
							promises.push(curPromise);
							curPromise.then(
								function(mResult){ 
									var listofCurIPs = JSON.parse(mResult); 
									listofCurIPs.forEach(function(curManagerIP){
										curManagerIP = curManagerIP.replace("::ffff:", "").replace("::FFFF:", "");
										if(curManagerIP == ip){
											shouldAuth = true;
											if(!isTokenSent){ isTokenSent = true; sendToken(ip, res);}
											return 0;
										}
									});
								}
							).fail(
								function(mIssue){
									tools.logger.error("Failure to verify manager", mIssue);
									res.status(401).json({status:'fail'});
								}
							);
						});
						Q.all(promises).
							then( function(){ res.status(401).json({status:'fail'}); }).
							fail( function(){ res.status(401).json({status:'fail'}); });
					}
				}
			).fail(
				function(issue){
					tools.logger.error("Failure to reach to first manager", issue);
					res.status(401).json({status:'fail'});
				}
			);
		} else {
			res.status(500).json({status:'fail'});
		}
	});

	apiRoutes.get('/', tools.checkToken, function(req, res) {
		res.json({ message: 'Welcome to the coolest API on earth!' });
	});

	app.use('/api', apiRoutes);
};