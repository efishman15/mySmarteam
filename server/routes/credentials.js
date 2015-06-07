// Retrieve
var mongoClient = require('mongodb').MongoClient;
var CONNECTION_STRING = "mongodb://localhost:27017/studyB4";
var md5 = require("MD5");
var uuid = require('node-uuid');
var async = require('async');

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

                console.log("Found user with email:" + user.email);
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
                var sessionsCollection = db.collection("Sessions");
                callback(null, db, sessionsCollection);
            })
        },

        //Look for this session
        function (db, sessionsCollection, callback) {
            console.log("Logout Token: " + token);
            sessionsCollection.remove({
                "userToken" : token
            }, 1, function (err, numberOfRemovedDocs) {
                if (err) {
                    //Session does not exist - stop the call chain
                    console.dir(err);
                    callback(err, message);
                    return;
                }

                console.log("no errors deleting session with token: " + token + ". No of docs removed: " + numberOfRemovedDocs);
                callback(null, db);
            })
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
        "userToken": uuid.v1()
    }, {}, function (err, item) {

        if (err) {
            console.dir(err);
            callback(err, "Error creating sessions for adminId: " + adminId);
        }

        callback(null, db, userToken);
    })
}