// Retrieve
var md5 = require("MD5");
var uuid = require('node-uuid');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
var dal = require('../dal/myMongoDB');
var excptions = require('../utils/exceptions');
var generalUtils = require('../utils/general');

module.exports.register = function (req, res, next) {
    var user = req.body;

    var operations = [

        //Connect to the database
        dal.connect,

        //Register the new admin
        function (dbHelper, callback) {
            register(dbHelper, user, callback);
        },

        createOrUpdateSession, //dbHelper, admin, callback

        //Close the db
        function (dbHelper, session, callback) {
            dbHelper.close();
            callback(null, session);
        }
    ];

    async.waterfall(operations, function (err, session) {
        if (!err) {
            res.json(getSessionResponse(session))
        }
        else {
            res.send(err.status, err);
        }
    });
}

module.exports.login = function (req, res, next) {
    var user = req.body;
    var operations = [

        //connect
        dal.connect,

        //login
        function (dbHelper, callback) {
            login(dbHelper, user, callback);
        },

        //Create session
        createOrUpdateSession,

        //Close the db
        function (dbHelper, session, callback) {
            dbHelper.close();
            callback(null, session);
        }
    ];

    async.waterfall(operations, function (err, session) {
        if (!err) {
            res.json(getSessionResponse(session))
        }
        else {
            res.send(err.status, err);
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

    async.waterfall(operations, function (err) {
        if (!err) {
            res.send(200, "OK");
        }
        else {
            res.send(err.status, err);
        }
    })
};

//Try to register the new admin
function register(dbHelper, user, callback) {
    var adminsCollection = dbHelper.getCollection("Admins");
    var language = generalUtils.getLanguageByCountryCode(user.geoInfo.country_code);
    var newAdmin = {
        "email": user.email,
        "password": md5(user.password + "|" + user.email),
        "geoInfo": user.geoInfo,
        "settings" : {
            "passwordProtected" : true,
            "questionsLanguage": language,
            "interfaceLanguage": language
        }
    };

    adminsCollection.insert(newAdmin
        , {}, function (err, result) {
            if (err) {
                if (err.code == 11000) {
                    callback(new excptions.FormValidationError(424, 'email', 'The email ' + user.email + ' is already taken'));
                }
                else {
                    callback(new excptions.GeneralError(500));
                }
                return;
            }
            callback(null, dbHelper, newAdmin);
        })
};

//Login and return the adminId if email/password match
function login(dbHelper, user, callback) {
    var adminsCollection = dbHelper.getCollection("Admins");
    adminsCollection.findOne({
        "email": user.email,
        "password": md5(user.password + "|" + user.email)
    }, {}, function (err, admin) {
        if (err || !admin) {
            callback(new excptions.GeneralError(424, "Invalid Email or Password"));
            return;
        }

        callback(null, dbHelper, admin);
    })
};

//Create the session
function createOrUpdateSession(dbHelper, admin, callback) {
    var userToken = uuid.v1();
    var sessionsCollection = dbHelper.getCollection('Sessions');
    sessionsCollection.findAndModify({"adminId": ObjectId(admin._id)}, {},
        {
            $set: {
                "adminId": ObjectId(admin._id),
                "createdAt": new Date(),
                "userToken": userToken,
                "direction": generalUtils.getDirectionByLanguage(admin.settings.interfaceLanguage),
                "settings" : {
                    "passwordProtected": admin.settings.passwordProtected,
                    "questionsLanguage": admin.settings.questionsLanguage,
                    "interfaceLanguage": admin.settings.interfaceLanguage
                }
            }
        }, {upsert: true, new: true}, function (err, session) {

            if (err) {
                console.log("Error finding session for admin Id: " + adminId + ", err: " + JSON.stringify(err));
                callback(new excptions.GeneralError(500));
                return;
            }
            callback(null, dbHelper, session.value);
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
                callback(new excptions.GeneralError(500));
                return;
            }
            ;
            callback(null, dbHelper);
        }
    )
};

function getSessionResponse(session) {
    return {
        "token": session.userToken,
        "direction": session.direction,
        "settings": session.settings
    };
}