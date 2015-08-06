var Q			= require('q');
var config 		= require('../config/config.main.js');
var jwt			= require('jsonwebtoken');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	apiRoutes.post('/assignstoragepools', tools.checkToken, function(req, res) {
		res.json({ message: 'ok' });
	});

	app.use('/api/command', apiRoutes);
};