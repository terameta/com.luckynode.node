var Q			= require('q');
var config 		= require('../config/config.main.js');
var jwt			= require('jsonwebtoken');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	apiRoutes.post('/assignstoragepools', tools.checkToken, function(req, res) {
		var newPools = [];
		if(req.body){ if(req.body.details){ if(req.body.details.length > 0){
			newPools = req.body.details;
		} } }
		
		if(newPools.length > 0){
		
			var exec = require('child_process').exec;
			var cmd = 'virsh pool-list';
			
			exec(cmd, function(error, stdout, stderr) {
				if (error) {
					console.log(stderr);
				} else {
					
					
					
					var result = stdout.trim().split("\n");
					var numPools = result.length - 2;
					if(numPools < 0) numPools = 0;
					
					
					console.log("===# new Pools: ", newPools.length);
					console.log("===# exs Pools: ", numPools);
					
					
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
			res.send("ok");
		} else {
			res.status(400).json({ status: 'fail', detail: 'no data provided' });
		}
	});

	app.use('/api/command', apiRoutes);
};