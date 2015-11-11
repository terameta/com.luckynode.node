var topDB = {};

module.exports = function(db){
    var curModule = {
        kekele: getCollectionNames
    };
    
    curModule.everytensecs = function(){
        console.log(new Date(), topDB, db);
    };
    
    return curModule;
};

function getCollectionNames(){
	console.log("This is kekele");
}
