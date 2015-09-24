var cluster         = require( 'cluster' );
var cCPUs           = require('os').cpus().length;
var fs				= require('fs');
var tools			= require('./tools/tools.main.js');

var mongojs 		= require('mongojs');

var dbconfig;

try {
	dbconfig = fs.readFileSync("dbconf.conf", "utf8");
	console.log("dbconfig exists");
}
catch (err) {
	// If the type is not what you want, then just throw the error again.
	var curManagers = fs.readFileSync('managerip', "utf-8").trim().split(',');
	if (err.code !== 'ENOENT') throw err;
	tools.sendHTTPSRequest(curManagers[0], '/api/getDBConfigForNode', false).then(function(result){
		fs.writeFileSync("dbconf.conf", result, "utf-8");
		console.log("Database config is received, we will now restart the system");
		process.exit(1);
	}).fail(function(issue){
		process.exit(1);
		console.log("Gettik sıçtık database config", issue);
	});
	// Handle a file-not-found error aa
}

var cloudConnStr	= dbconfig.user+':'+dbconfig.pass+'@'+dbconfig.server+':'+dbconfig.port+'/'+dbconfig.database;
var cloudColls		= ['users','datacenters','nodes','ipblocks','storages','nodecs','nodetokens','managers','plans','servers','images','isofiles'];
var db 				= mongojs(cloudConnStr, cloudColls, {	ssl: true,    authMechanism : 'ScramSHA1',	cert: dbconfig.pemfile	});
console.log(db);

var App             = require('./config/config.app.js');
var cronerpid 		= 0;
var Croner          = require('./config/config.croner.js');

if( cluster.isMaster ) {

    var croner_env = {}; croner_env.isCroner = 1;
    var worker_env = {}; worker_env.isCroner = 0;

    for( var i = 0; i < cCPUs; i++ ) {
        var workerpid = cluster.fork(worker_env).process.pid;
    }

    cronerpid = cluster.fork(croner_env).process.pid;

    cluster.on( 'online', function( worker ) {
    	if(worker.process.pid == cronerpid){
        	console.log( 'Croner ' + worker.process.pid + ' is online.' );
    	} else {
    		console.log( 'Worker ' + worker.process.pid + ' is online.' );
    	}
    });
    cluster.on( 'exit', function( worker, code, signal ) {
        if(worker.process.pid == cronerpid){
        	console.log( 'Croner ' + worker.process.pid + ' died.' );
        	//cronerpid = cluster.fork(croner_env).process.pid;
        } else {
        	console.log( 'Worker ' + worker.process.pid + ' died.' );
        	//cluster.fork(worker_env);
        }
    });
} else {
	if(process.env.isCroner == 1){
		var croner = new Croner();
	} else {
		var app = new App(db);
	}
}