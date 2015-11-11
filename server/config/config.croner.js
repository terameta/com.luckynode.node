module.exports = function Croner() {
	var croner				= require('cron').CronJob;
	var crons				= require('../tools/tools.crons.js')(1003);
	var jobS = new croner(
		'*/3 * * * * *',
		function(){
			crons.everytensecs(); 
			crons.kekele();
		},
		true,
		"America/Los_Angeles"
	);
	
	module.exports = Croner;
};