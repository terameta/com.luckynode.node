//var Q			= require('q');
//var config 		= require('../config/config.main.js');
//var jwt			= require('jsonwebtoken');
var virsh 		= require('../tools/tools.virsh.js');
//var mongojs 	= require('mongojs');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	apiRoutes.get('/server/:id/', function(req, res) {
		virsh.virshTools.server.stateUpdate(req.params.id);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(req.params.id); }, 5000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(req.params.id); }, 10000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(req.params.id); }, 15000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(req.params.id); }, 20000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(req.params.id); }, 25000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(req.params.id); }, 30000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(req.params.id); }, 35000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(req.params.id); }, 40000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(req.params.id); }, 45000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(req.params.id); }, 50000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(req.params.id); }, 55000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(req.params.id); }, 60000);
		res.send("OK");
	});
	
	app.use('/api/hook', apiRoutes);
};