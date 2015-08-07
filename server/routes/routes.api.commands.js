var Q			= require('q');
var config 		= require('../config/config.main.js');
var jwt			= require('jsonwebtoken');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	apiRoutes.post('/assignstoragepools', tools.checkToken, function(req, res) {
		console.log(req.body);
		var exec = require('child_process').exec;
		var cmd = 'virsh pool-list';
		
		exec(cmd, function(error, stdout, stderr) {
			if (error) {
				console.log(stderr);
			} else {
				var result = stdout.trim().split("\n");
				if(result.length>0){
					var headers = result[0].split("\t");
					console.log(headers);
				}
				console.log(result);
			}
		});
		res.json({ message: 'ok' });
	});

	app.use('/api/command', apiRoutes);
};