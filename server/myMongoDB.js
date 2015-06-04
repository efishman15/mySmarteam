var sessions;

// Retrieve
var mongoClient = require('mongodb').MongoClient;

// Connect to the db
mongoClient.connect("mongodb://localhost:27017/test", function(err, db) {
    if(err) { return console.dir(err); }

    var collection = db.collection('ionic_tutorial');

    collection.findOne({_id: 1}, function(err, item) {
        sessions = item}
    );
});
