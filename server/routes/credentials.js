// Retrieve
var mongoClient = require('mongodb').MongoClient;
var CONNECTION_STRING = "mongodb://localhost:27017/studyB4";
var md5 = require("MD5");
var uuid = require('node-uuid');
var async = require('async');

exports.register = function (req, res, next) {
    var user = req.body;
    console.log("about to register:");
    console.log(JSON.stringify(user, null, 2));

    var operations = [

        //Connect to the db
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

        //Get the admin collections
        function (db, callback) {
            var adminsCollection = db.collection("Admins");
            console.log("Admin collection: " + adminsCollection);
            callback(null, db, adminsCollection);
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

        //Get the sessions collection
        function (db, adminId, callback) {
            var sessionsCollection = db.collection('Sessions');
            callback(null, db, sessionsCollection, adminId);
        },

        //Create the session
        function (db, sessionsCollection, adminId, callback) {
            var userToken = uuid.v1();
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
        },

        function (db, userToken, callback) {
            db.close();
            callback(null, userToken);
        }
    ];

    async.waterfall(operations, function (err, result) {
        console.log("err: " + err);
        console.log("result: " + result);
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
    console.log("email: " + user.email);
    console.log("password: " + user.password);
    res.send({"token": "1234567890"})
};

exports.logout = function (req, res, next) {
    var token = req.headers.authorization;
    console.log("logged out user with token: " + token);
    res.send(200, "OK")
};
