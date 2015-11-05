var Q				= require('q');

module.exports = {
	prepare: prepare
};

function prepare(result, command){
	var deferred = Q.defer();
	var wte = ''; 		//What to Expect
	if(command == 'vol-list'){	wte = ['Name', 'Path', 'Type', 'Capacity', 'Allocation'];	}
	console.log(result);
	console.log(wte);
	var lines = result.split('\n');
	console.log(lines);
	deferred.resolve(result);
	return deferred.promise;
}