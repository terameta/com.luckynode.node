var express 		= require('express');
var path 			= require('path');
var logger			= require('morgan');
//var bodyParser		= require('body-parser');
//var cookieParser	= require('cookie-parser');
var config			= require('../config/config.main.js');
var tools			= require('../tools/tools.main.js');


module.exports = function App(db) {
	var app = express();

	//view engine setup
	app.set('views', path.join(__dirname, '../views'));
//	app.engine('html', require('ejs').renderFile);
	app.set('view engine', 'html');
	app.set('jwtsecret', config.secret);

	app.enable("trust proxy");

	app.use(logger('short'));
	//app.use(bodyParser.json({ limit: '50mb' }));
	//app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

	//app.use(express.static(path.join(__dirname, '../../client')));

	require('../routes/index.js')(app, express, db, tools);

	app.set('port', 14413);


	var server = app.listen(app.get('port'), '0.0.0.0', function() {
		console.log('Express server listening on port ' + server.address().port);
	});

	module.exports = app;
};
