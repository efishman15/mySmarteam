// Retrieve
var mongoClient = require('mongodb').MongoClient;
var CONNECTION_STRING = "mongodb://localhost:27017/studyB4";
var md5 = require("MD5");
var uuid = require('node-uuid');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;

exports.register = function (req, res, next) {
    var user = req.body;

    var operations = [

        //Connect to the db and get the adminsCollection
        function (callback) {
            mongoClient.connect(CONNECTION_STRING, function (err, db) {
                if (err) {
                    var message = "Error connecting to the database";
                    console.log(message);
                    callback(err, message);
                    return;
                }
                var adminsCollection = db.collection("Admins");
                callback(null, db, adminsCollection);
            })
        },

        //Try to insert the new admin
        function (db, adminsCollection, callback) {
            adminsCollection.insert({
                "email": user.email,
                "password": md5(user.password + "|" + user.email)
            }, {}, function (err, item) {
                if (err) {
                    var message;
                    if (err.code == 11000) {
                        message = "Duplicate key for email: " + user.email;
                    }
                    else {
                        message = "Error inserting admin with email: " + user.email + " to the database";
                    }
                    console.log(message);
                    callback(err, message);
                    return;
                }

                callback(null, db, item._id);
            })
        },

        createSession,

        //Close the db
        function (db, userToken, callback) {
            db.close();
            callback(null, userToken);
        }
    ];

    async.waterfall(operations, function (err, result) {
        if (!err) {
            res.json({"token": result})
        }
        else {
            res.status(500).json({"error": result});
        }
    });
}

exports.login = function (req, res, next) {
    var user = req.body;

    var operations = [

        //Connect to the db and get the adminsCollection
        function (callback) {
            mongoClient.connect(CONNECTION_STRING, function (err, db) {
                if (err) {
                    var message = "Error connecting to the database";
                    console.log(message);
                    callback(err, message);
                    return;
                }
                var adminsCollection = db.collection("Admins");
                callback(null, db, adminsCollection);
            })
        },

        //Look for this admin
        function (db, adminsCollection, callback) {
            adminsCollection.findOne({
                "email": user.email,
                "password": md5(user.password + "|" + user.email)
            }, {}, function (err, item) {
                if (err) {
                    console.log("Error finding user with email:" + user.email);
                    var message = "Invalid Email or Password";
                    console.log(message);
                    callback(err, message);
                    return;
                }

                callback(null, db, item._id);
            })
        },

        createSession,

        //Close the db
        function (db, userToken, callback) {
            db.close();
            callback(null, userToken);
        }
    ];

    async.waterfall(operations, function (err, result) {
        if (!err) {
            res.json({"token": result})
        }
        else {
            res.status(403).json({"error": result});
        }
    });
}

exports.logout = function (req, res, next) {
    var token = req.headers.authorization;

    var operations = [

        //Connect to the db and get the adminsCollection
        function (callback) {
            mongoClient.connect(CONNECTION_STRING, function (err, db) {
                if (err) {
                    var message = "Error connecting to the database";
                    console.log(message);
                    callback(err, message);
                    return;
                }
                callback(null, db);
            })
        },

        //Get the Sessions collection
        function (db, callback) {
            db.collection("Sessions", {}, function (err, sessionsCollection) {
                callback(null, db, sessionsCollection);
            })
        },

        //Look for this session
        function (db, sessionsCollection, callback) {
            sessionsCollection.remove(
                {
                    "userToken": token
                }
                , {w: 1, single: true},
                function (err, numberOfRemovedDocs) {
                    if (err) {
                        //Session does not exist - stop the call chain
                        console.log("error finding session with token: " + token, "error: " + err);
                        callback(err, message);
                        return;
                    }
                    ;
                    callback(null, db);
                }
            )
        },

        //Close the db
        function (db, callback) {
            db.close();
            callback(null);
        }
    ];

    async.waterfall(operations, function (err, result) {
        if (!err) {
            res.send(200, "OK");
        }
        else {
            res.status(403).json({"error": result});
        }
    })
};

//Create the session
function createSession(db, adminId, callback) {
    var userToken = uuid.v1();
    var sessionsCollection = db.collection('Sessions');
    sessionsCollection.insert({
        "adminId": adminId,
        "createdAt": new Date(),
        "userToken": userToken
    }, {}, function (err, item) {

        if (err) {
            console.dir(err);
            callback(err, "Error creating sessions for adminId: " + adminId);
        }

        callback(null, db, userToken);
    })
}