var mongoClient = require('mongodb').MongoClient;
var CONNECTION_STRING = "mongodb://localhost:27017/studyB4";

exports.connect = function (callback) {
    mongoClient.connect(CONNECTION_STRING, function (err, db) {
        if (err) {
            var message = "Error connecting to the database";
            console.log(message);
            callback(err, message);
            return;
        }
        callback(null, new DbHelper(db));
    })
}

///Class DbHelper
function DbHelper(db) {
    this.db = db;
}

//Class Methods
DbHelper.prototype.getCollection = function(collectionName) {
    return this.db.collection(collectionName);
}

DbHelper.prototype.close = function() {
    return this.db.close();
}
