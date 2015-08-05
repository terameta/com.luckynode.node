module.exports = function(app, passport) {
	app.get('/', function(req, res) {
		res.send('ok');
	});
	
	app.get('/getmanagers', function(req, res){
		res.send(app.get('managers'));
	});
};


