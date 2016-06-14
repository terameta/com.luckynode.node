module.exports = function Croner(db) {
	var croner				= require('cron').CronJob;
	var crons				= require('../tools/tools.crons.js')(db);
	new croner( '*/10 	* 	* 	* 	* 	*', 	crons.everytensecs, 	true, 	"America/Los_Angeles" );
	new croner( '0 		* 	* 	* 	* 	*', 	crons.everyminute, 		true, 	"America/Los_Angeles" );
	new croner( '30 	*/5	* 	* 	* 	*', 	crons.everyfiveminute, 		true, 	"America/Los_Angeles" );
	
	module.exports = Croner;
};