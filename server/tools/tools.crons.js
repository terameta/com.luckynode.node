var tools = require("../tools/tools.main.js");

module.exports = function(){
    var curModule = {
        kekele: getCollectionNames,
        everytensecs: everytensecs,
        everyminute: everyminute
    };
    /*
    curModule.everytensecs = function(){
        console.log(new Date(), topDB, db);
    };
    */
    
    return curModule;
};

function getCollectionNames(){
	console.log("This is kekele");
}

function everytensecs(){
    console.log(new Date(), "Ten Secs");
}


function everyminute(){
    console.log("This is everyminute");
}