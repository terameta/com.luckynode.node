module.exports = function(app, express, db, tools) {

	var apiRoutes = express.Router();

	apiRoutes.get('/authenticate', function(req, res) {
		var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
		ip = ip.replace("::ffff:", "");
		ip = ip.replace("::FFFF:", "");
		console.log(ip);
		
		var curManagers = app.get('managers');
		curManagers.forEach(function(curManager){
			console.log(curManager);
			if(curManager == ip){
				console.log("Match: ", curManager, ip);
			} else {
				console.log("Fail: ", curManager, ip);
			}
		});
		res.send(app.get('managers'));
	});

	apiRoutes.get('/', tools.checkToken, function(req, res) {
		res.json({ message: 'Welcome to the coolest API on earth!' });
	});

	app.use('/api', apiRoutes);
};