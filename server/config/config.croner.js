module.exports = function Croner() {
	var croner				= require('cron').CronJob;
	var crons				= require('../tools/tools.crons.js');
	var jobS = new croner(
		'*/10 * * * * *',
		function(){
			console.log(crons);
			crons.everytensecs(); 
			console.log("This is every ten secs");
		},
		true,
		"America/Los_Angeles"
	);
	
	module.exports = Croner;
};