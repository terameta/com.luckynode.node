var Q			= require('q');
var config 		= require('../config/config.main.js');
var jwt			= require('jsonwebtoken');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	apiRoutes.post('/assignstoragepools', tools.checkToken, function(req, res) {
		var exec = require('child_process').exec;
		var cmd = 'virsh pool-list';
		
		exec(cmd, function(error, stdout, stderr) {
			if (error) {
				console.log(stderr);
			} else {
				console.log(req.body);
				
				var result = stdout.trim().split("\n");
				if(result.length>0){
					var headers = result[0].trim().split(/[\s,]+/);
					
					console.log(headers);
				}
				var numPools = result.length - 2;
				console.log("================================");
				console.log("Number of already defined pools: ", numPools);
				console.log("================================");
				console.log("List below:");
				console.log("================================");
				var curPoolDef = [];
				for(var curPool = 2; curPool < result.length; curPool++){
					curPoolDef = result[curPool].trim().split(/[\s,]+/);
					console.log(result[curPool], ">>>>>>>>>>>>>>>>>>>>>>>>",curPoolDef);
				}
				console.log("================================");
				console.log("End of list");
			}
		});
		res.json({ message: 'ok' });
	});

	app.use('/api/command', apiRoutes);
};