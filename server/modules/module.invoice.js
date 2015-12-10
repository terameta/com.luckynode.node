var db;
var Q					= require('q');
var mongojs 		= require('mongojs');
var moment			= require('moment');

module.exports = function(refdb){
	db = refdb;
	var module = {
		generateMissing: generateMissing
	};
	return module;
};

function generateMissing(){
	console.log("This is generate missing", moment().format());
	db.servers.find({}, function(err, result){
		if(err){
			console.log(err);
		} else {
			console.log(result.length);
			console.log(result);
		}
	});
}