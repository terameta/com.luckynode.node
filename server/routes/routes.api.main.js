module.exports = function(app, express, db, tools) {
	var Q			= require('q');

	var apiRoutes = express.Router();
	
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
		
		var req = http.request(options, callback).end();
		
		req.on('error', function(e) {
		  deferred.reject('problem with request: ' + e.message);
		});
		
		return deferred.promise;
	}

	apiRoutes.get('/authenticate', function(req, res) {
		var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
		ip = ip.replace("::ffff:", "");
		ip = ip.replace("::FFFF:", "");
		console.log(ip);
		var shouldAuth = false;
		
		var curManagers = app.get('managers');
		curManagers.forEach(function(curManager){
			if(curManager == ip){
				shouldAuth = true;
			}
		});
		if(!shouldAuth && curManagers.length > 0){
			sendHTTPSRequest(curManagers[0], '/api/getManagers', false).then(
				function(result){
					var listofIPs = JSON.parse(result);
					console.log("Result: ", listofIPs);
					console.log(typeof listofIPs);
					listofIPs.forEach(function(curManager){
						console.log(curManager);
					});
				}
			).fail(
				function(issue){
					console.log("Issue: ", issue);
				}
			);
		}
		if(shouldAuth){
			var token = tools.jwt.sign(ip, app.get('jwtsecret'), {
				expiresInMinutes: 60*24*30 // expires in 30 days
			});
			res.json({
				status: 'success',
				message: 'Enjoy your token!',
				token: token
			});
		} else {
			res.status(401).json({status:'fail'});
		}
	});

	apiRoutes.get('/', tools.checkToken, function(req, res) {
		res.json({ message: 'Welcome to the coolest API on earth!' });
	});

	app.use('/api', apiRoutes);
};