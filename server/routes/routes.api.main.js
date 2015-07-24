module.exports = function(app, express, db, tools) {

	var apiRoutes = express.Router();

	apiRoutes.get('/authenticate', function(req, res) {
		res.send(app.get('managers'));
	});

	apiRoutes.get('/', tools.checkToken, function(req, res) {
		res.json({ message: 'Welcome to the coolest API on earth!' });
	});

	app.use('/api', apiRoutes);
};