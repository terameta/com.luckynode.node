module.exports = function(app, passport) {
	app.get('/', function(req, res) {
		//res.send('keke');
		res.send('ok');
	});

	app.get('/signin', function(req, res){
		res.render('signin');
	});

	app.get('/home', function(req, res){
		res.render('home');
	});

	app.post('/signin', function(req, res){
		console.log("====================================================================");
		console.log(req.body);
		console.log(req.body.user);
		console.log(req.body.pass);
		console.log("====================================================================");
		res.send('ok');
	});
};