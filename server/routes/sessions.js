// Retrieve
var mongoClient = require('mongodb').MongoClient;

console.log("MongoDB initialted...");

var sessions;

exports.initSessions = function() {
	// Connect to the db
	mongoClient.connect("mongodb://localhost:27017/test", function(err, db) {
		if(err) {
			return console.dir(err);
		}

		var collection = db.collection('ionic_tutorial');
		console.log("Opened collection...");
		collection.findOne({"_id": 1}, function(err, item) {
				if (err) {
					return console.dir(err);
				}
				db.close();
				console.log("Closed db...");
				console.log("found " + item.sessions.length + " sessions...");
				sessions = item.sessions;
		});
	});
};

exports.findAll = function (req, res, next) {
	res.send(sessions);
};

exports.findById = function (req, res, next) {
    var id = req.params.id;
    res.send(sessions[id]);
};