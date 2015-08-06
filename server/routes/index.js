var fs 		= require('fs');
var path    = require('path');

module.exports = function(app, express, db, tools) {
	parseFolder(__dirname);

	function parseFolder(curFolder){
		fs.readdirSync(curFolder).forEach(function(curItem){
			var fullName = path.join(curFolder, curItem);
			var stat = fs.lstatSync(fullName);
			if(stat.isDirectory()){
				parseFolder(fullName);
			} else if( fullName.substr(fullName.lastIndexOf('.') + 1) == 'js' && curItem != 'index.js' ){
				require(fullName)(app, express, db, tools);
			}
		});
	}
};