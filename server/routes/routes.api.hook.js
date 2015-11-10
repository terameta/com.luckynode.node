//var Q			= require('q');
//var config 		= require('../config/config.main.js');
//var jwt			= require('jsonwebtoken');
var virsh 		= require('../tools/tools.virsh.js');
//var mongojs 	= require('mongojs');

module.exports = function(app, express, db, tools) {
	

	var apiRoutes = express.Router();
	
	apiRoutes.get('/:id/', function(req, res) {
		
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(); }, 1000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(); }, 2000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(); }, 3000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(); }, 4000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(); }, 5000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(); }, 6000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(); }, 7000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(); }, 8000);
		setTimeout(function(){ virsh.virshTools.server.stateUpdate(); }, 9000);
		console.log("Hook ID:", req.params.id);
		console.log("Hook Status:", req.params.state);
		console.log("Hook Action", req.params.action);
		console.log("Hook Bilmem", req.params.bilmem);
		res.send("OK");
	});
	
	app.use('/api/hook', apiRoutes);
};