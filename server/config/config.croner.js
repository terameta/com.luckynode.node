module.exports = function Croner() {
	var croner				= require('cron').CronJob;
	var crons				= require('../tools/tools.crons.js');
	var jobS = new croner(
		'*/3 * * * * *',
		function(){
			console.log(crons);
			console.log(new Date());
			crons.everytensecs(); 
			console.log("This is every ten secs");
		},
		true,
		"America/Los_Angeles"
	);
	
	module.exports = Croner;
};