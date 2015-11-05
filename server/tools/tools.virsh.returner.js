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
	for( var cl = 0; cl < lines.length; cl++ ){
		lines[cl] = lines[cl].trim();
	}
	
	var places = [];
	if(lines.length == 0){
		deferred.reject("Result is not valid");
	} else {
		for( var i = 0; i < wte.length; i++ ){
			places[i] = lines[0].indexOf(wte[i]);
			console.log(wte[i], places[i]);
		}
		
		var curPlace = 0;
		var nexPlace = 0;
		
		var curObject = {};
		
		for( var l = 2; l < lines.length; l++ ){
			curObject = {};
			console.log("===================================================");
			console.log(l, lines[l]);
			for( var p = 0; p < places.length; p++ ){
				curPlace = 0;
				nexPlace = 0;
				curPlace = places[p];
				if(p != (places.length -1) ) nexPlace = nexPlace = places[p+1];
				var curProp = '';
				if(nexPlace > 0){
					curProp = lines[l].substring(curPlace,nexPlace).trim();
				} else {
					curProp = lines[l].substring(curPlace).trim();
				}
				console.log(p, wte[p], curProp);
				curObject[wte[p]] = curProp;
			}
			console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
			console.log(curObject);
			console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
		}
	}
	deferred.resolve(result);
	return deferred.promise;
}