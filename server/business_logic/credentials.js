// Retrieve
var md5 = require("MD5");
var uuid = require('node-uuid');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
var dal = require('../dal/myMongoDB');
var excptions = require('../business_logic/exceptions');

module.exports.register = function (req, res, next) {
    var user = req.body;

    var operations = [

        //Connect to the database
        dal.connect,

        //Register the new admin
        function (dbHelper, callback) {
            register(dbHelper, user, callback);
        },

        createSession, //db, adminId, callback

        //Close the db
        function (dbHelper, userToken, callback) {
            dbHelper.close();
            callback(null, userToken);
        }
    ];

    async.waterfall(operations, function (err, result) {
        if (!err) {
            res.json({"token": result})
        }
        else {
            res.send(err.status,err);
        }
    });
}

module.exports.login = function (req, res, next) {
    var user = req.body;

    var operations = [

        //connect
        dal.connect, //"returns" db

        //login
        function (dbHelper, callback) {
            login(dbHelper, user, callback);
        },

        //Create session
        createSession,

        //Close the db
        function (dbHelper, userToken, callback) {
            dbHelper.close();
            callback(null, userToken);
        }
    ];

    async.waterfall(operations, function (err, result) {
        if (!err) {
            res.json({"token": result})
        }
        else {
            res.send(err.status,err);
        }
    });
}

module.exports.logout = function (req, res, next) {
    var token = req.headers.authorization;

    var operations = [

        //Connect
        dal.connect,

        //Logout
        function (dbHelper, callback) {
            logout(dbHelper, token, callback);
        },

        //Close the db
        function (dbHelper, callback) {
            dbHelper.close();
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

//Try to register the new admin
function register(dbHelper, user, callback) {
    var adminsCollection = dbHelper.getCollection("Admins");
    adminsCollection.insert({
        "email": user.email,
        "password": md5(user.password + "|" + user.email)
    }, {}, function (err, item) {
        if (err) {
            var message;
            if (err.code == 11000) {
                callback(new excptions.FormValidationError(424, 'email', 'The email ' + user.email + ' is already taken'));
            }
            else {
                callback(new excptions.GeneralError(500));
            }
            return;
        }

        callback(null, dbHelper, item._id);
    })
};

//Login and return the adminId if email/password match
function login(dbHelper, user, callback) {
    var adminsCollection = dbHelper.getCollection("Admins");
    adminsCollection.findOne({
        "email": user.email,
        "password": md5(user.password + "|" + user.email)
    }, {}, function (err, item) {
        if (err || !item) {
            callback(new excptions.GeneralError(424, "Invalid Email or Password"));
            return;
        }

        callback(null, dbHelper, item._id);
    })
};

//Create the session
function createSession(dbHelper, adminId, callback) {
    var userToken = uuid.v1();
    var sessionsCollection = dbHelper.getCollection('Sessions');
    sessionsCollection.insert({
        "adminId": adminId,
        "createdAt": new Date(),
        "userToken": userToken
    }, {}, function (err, item) {

        if (err) {
            console.dir(err);
            callback(err, "Error creating sessions for adminId: " + adminId);
        }

        callback(null, dbHelper, userToken);
    })
};

//Logout (remove session)
function logout(dbHelper, token, callback) {
    var sessionsCollection = dbHelper.getCollection("Sessions");
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
            callback(null, dbHelper);
        }
    )
};