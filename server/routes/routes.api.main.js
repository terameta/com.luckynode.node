module.exports = function(app, express, db, tools) {

	var apiRoutes = express.Router();

	apiRoutes.post('/authenticate', function(req, res) {
		//console.log(req.body);
		db.users.findOne({email:req.body.email},function(err, data){
			if(err) { res.status(400).json(err); }
			else {
				if( data == null){ res.status(401).json({status:'fail'}); }
				else {
					if(!tools.compareHash(req.body.pass, data.pass)){
						res.status(401).json({status:'fail'});
					} else {
						var token = tools.jwt.sign(data.email, app.get('jwtsecret'), {
							expiresInMinutes: 60*24*30 // expires in 30 days
						});
						res.json({
							status: 'success',
							message: 'Enjoy your token!',
							token: token
						});
					}
				}
			}
		});
	});

	apiRoutes.get('/', tools.checkToken, function(req, res) {
		res.json({ message: 'Welcome to the coolest API on earth!' });
	});

	app.use('/api', apiRoutes);
};