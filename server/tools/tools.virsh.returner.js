var Q				= require('q');

module.exports = {
	prepare: prepare
};

function prepare(result, command){
	var deferred = Q.defer();
	var wte = ''; 		//What to Expect
	if(command == 'vol-list'){	wte = ['Name', 'Path', 'Type', 'Capacity', 'Allocation'];	}
	result = result.trim();
	console.log(result);
	console.log(wte);
	var lines = result.split('\n');
	var places = [];
	if(lines.length == 0){
		deferred.reject("Result is not valid");
	} else {
		var curPos = 0;
		var curLen = 0;
		for( var i = 0; i < wte.length; i++){
			curPos = lines[0].indexOf(wte[i]);
			console.log(wte[i], curPos);
		}
	}
	
	console.log(lines);
	deferred.resolve(result);
	return deferred.promise;
}