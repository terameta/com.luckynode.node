var topDB = {};

module.exports = function crons(db) {
	topDB = db;
	
};

function getCollectionNames(){
	topDB.getCollectionNames(function(err, result){
		if(err){
			console.log("Get Collection Names Error", err);
		} else {
			console.log("List of Collections:", result);
		}
	});
}

exports.everytensecs = function everytensecs(){
    console.log(new Date(), topDB);
};