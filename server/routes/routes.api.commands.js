var Q			= require('q');
var config 		= require('../config/config.main.js');
var jwt			= require('jsonwebtoken');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	apiRoutes.get('/assignstoragepools', tools.checkToken, function(req, res) {
		console.log(req.body);
		res.json({ message: 'ok' });
	});

	app.use('/api/command', apiRoutes);
};