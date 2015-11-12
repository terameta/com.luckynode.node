module.exports = function Croner() {
	var croner				= require('cron').CronJob;
	var crons				= require('../tools/tools.crons.js')(1003);
	new croner( '*/10 	* 	* 	* 	* 	*', 	crons.everytensecs, 	true, 	"America/Los_Angeles" );
	new croner( '0 		* 	* 	* 	* 	*', 	crons.everyminute, 		true, 	"America/Los_Angeles" );
	
	module.exports = Croner;
};