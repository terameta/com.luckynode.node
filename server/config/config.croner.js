module.exports = function Croner() {
	var croner				= require('cron').CronJob;
	var crons				= require('./tools/tools.crons');
	var jobS = new croner(
		'*/10 * * * * *',
		function(){
			crons.everytensecs(); 
			console.log("This is every ten secs");
		},
		true,
		"America/Los_Angeles"
	);
	
	module.exports = Croner;
};