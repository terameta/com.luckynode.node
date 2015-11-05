var Q				= require('q');

module.exports = {
	prepare: prepare
};

function prepare(result, command){
	var deferred = Q.defer();
	var wte = ''; 		//What to Expect
	if(command == 'vol-list'){	wte = ['Name', 'Path', 'Type', 'Capacity', 'Allocation'];	}
	
	result = result.trim();

	var lines = result.split('\n');
	for( var cl = 0; cl < lines.length; cl++ ){
		lines[cl] = lines[cl].trim();
	}
	
	if(lines.length == 0){
		deferred.reject("Result is not valid");
	} else {
		var toReturn = [];
		var places = [];
		for( var i = 0; i < wte.length; i++ ){
			places[i] = lines[0].indexOf(wte[i]);
			var shouldIterate = true;
			while(shouldIterate){
				var isEmpty = true;
		
				for( var clc = 0; clc < lines.length; clc++ ){
					if(places[i] > 0){
						if( lines[clc][places[i] - 1] != ' ') isEmpty = false;
						console.log(isEmpty);
					}
				}
				
				if(isEmpty) shouldIterate = false;
				if(shouldIterate) places[i] = places[i] - 1;
			}
		}
		console.log(places);
		
		var curPlace = 0;
		var nexPlace = 0;
		
		var curObject = {};
		
		for( var l = 2; l < lines.length; l++ ){
			console.log("====================================================");
			console.log(lines[0]);	
			console.log(lines[l]);
			curObject = {};

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
			toReturn.push(curObject);
		}
		console.log(toReturn);
		deferred.resolve(toReturn);
	}
	return deferred.promise;
}