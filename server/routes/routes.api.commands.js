var Q			= require('q');
var config 		= require('../config/config.main.js');
var jwt			= require('jsonwebtoken');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	apiRoutes.post('/assignstoragepools', tools.checkToken, function(req, res) {
		console.log(req.body);
		var exec = require('child_process').exec;
		var cmd = 'virsh pool-liast';
		
		exec(cmd, function(error, stdout, stderr) {
		  console.log("Error: ", error);
		  console.log("StdOut: ");
		  console.log(stdout);
		  console.log("StdErr: ");
		  console.log(stderr);
		});
		res.json({ message: 'ok' });
	});

	app.use('/api/command', apiRoutes);
};