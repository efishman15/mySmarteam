// Retrieve
var mongoClient = require('mongodb').MongoClient;
var CONNECTION_STRING = "mongodb://localhost:27017/studyB4";
var md5 = require("MD5");

exports.register = function (req, res, next) {
	var user = req.body;
	console.log("about to register:");
	console.log(JSON.stringify(user, null, 2));


	mongoClient.connect(CONNECTION_STRING, function(err, db) {
		if(err) {
			res.status(500).json({ "error": "Error connecting to database"});
		}

		var admins = db.collection('Admins');
		admins.insert({"email": user.email, "password": md5(user.password + "|" + user.email)}, function(err, item) {

			if (err) {
				if (err.code == 11000) {
					res.status(500).json({ "error": "Email already exist."});
				}
			else {
				console.dir(err);
			}

				
		}});
	});

	res.send({"token": "0123456"})
};

exports.login = function (req, res, next) {
	var user = req.body;
	console.log("email: " + user.email);
	console.log("password: " + user.password);
	res.send({"token": "1234567890"})
};

exports.logout = function (req, res, next) {
	var token = req.headers.authorization;
	console.log("logged out user with token: " + token);
	res.send(200, "OK")
};
