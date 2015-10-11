var express 		= require('express');
var https			= require('https');
var fs				= require('fs');
var path 			= require('path');
var logger			= require('morgan');
var bodyParser		= require('body-parser');
//var cookieParser	= require('cookie-parser');
var config			= require('../config/config.main.js');
var tools			= require('../tools/tools.main.js');
var Q				= require('q');


module.exports = function App(db) {
	var app = express();

	//view engine setup
	app.set('views', path.join(__dirname, '../views'));
//	app.engine('html', require('ejs').renderFile);
	app.set('view engine', 'html');
	app.set('jwtsecret', config.secret);

	app.enable("trust proxy");

	app.use(logger('short'));
	app.use(bodyParser.json({ limit: '50mb' }));
	app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

	//app.use(express.static(path.join(__dirname, '../../client')));

	require('../routes/index.js')(app, express, db, tools);

	app.set('port', 14413);
	
	fs.readFile('managerip', "utf-8", function(err, data) {
		if (err) {
			tools.logger.error("Can't read managers file",null,false);
		} else {
			app.set('managers', data.trim().split(','));
		}
	});

	
	var httpsConfig = {
		key: fs.readFileSync('./cloud.key', 'utf-8'),
		cert: fs.readFileSync('./cloud.crt', 'utf-8')
	};
	
	https.createServer(httpsConfig,app).listen(app.get('port'));
	tools.logger.info('Express server listening on port ' + app.get('port'));

	module.exports = app;
};
