var topDB = {};

module.exports = function(db){
    var curModule = {};
    
    curModule.everytensecs = function(){
        console.log(new Date(), topDB, db);
    };
    
    return curModule;
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
