// Retrieve
var md5 = require("MD5");
var uuid = require('node-uuid');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
var dal = require('../dal/myMongoDB');
var excptions = require('../utils/exceptions');

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
};

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
};

module.exports.logout = function (req, res, next) {
    var token = req.headers.authorization;
    var password = null;
    if (req.body && req.body.password) {
        password = req.body.password;
    }

    var operations = [

        //Connect
        dal.connect,

        //Logout
        function (dbHelper, callback) {
            logout(dbHelper, token, password, callback);
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
    var newProfileId = uuid.v1(); //Pointer to the current (one and only) profile
    user.profiles = {};
    user.profiles[newProfileId] = {
        "id": newProfileId,
        "name": user.email.substring(0, user.email.indexOf('@')).replace('.', ' '),
        "sound": true,
        "questionsLanguage": user.settings.interfaceLanguage
    }
    var newAdmin = {
        "email": user.email,
        "password": md5(user.password + "|" + user.email),
        "geoInfo": user.geoInfo,
        "profiles": user.profiles,
        "settings": user.settings
    };

    adminsCollection.insert(newAdmin
        , {}, function (err, result) {
            if (err) {
                if (err.code == 11000) {
                    callback(new excptions.FormValidationError(424, 'email', 'serverErrorEmailAlreadyTaken'));
                }
                else {
                    callback(new excptions.GeneralError(500));
                }
                return;
            }

            //Carry the current profile Id on the newAdmin object - but no need to save the profileId in the Admins collection in db
            newAdmin.settings.profileId = newProfileId;

            callback(null, dbHelper, newAdmin);
        })
}

//Login and return the adminId if email/password match
function login(dbHelper, user, callback) {
    var adminsCollection = dbHelper.getCollection("Admins");
    adminsCollection.findOne({
        "email": user.email,
        "password": md5(user.password + "|" + user.email)
    }, {}, function (err, admin) {
        if (err || !admin) {
            callback(new excptions.GeneralError(424, "serverErrorInvalidEmailOrPassword"));
            return;
        }

        //Copy the current profile id pointer to the admin object so it can be saved into the session
        if (admin.profiles[user.settings.profileId]) {
            admin.settings.profileId = user.settings.profileId;
        }
        else {
            //Client sent a profile Id which was probably deleted in another device - point to the first profile
            admin.settings.profileId = admin.profiles[Object.keys(admin.profiles)[0]].id;
        }

        callback(null, dbHelper, admin);
    })
}

//Create the session
function createOrUpdateSession(dbHelper, admin, callback) {
    var userToken = uuid.v1();
    var sessionsCollection = dbHelper.getCollection('Sessions');
    sessionsCollection.findAndModify({"adminId": ObjectId(admin._id)}, {},
        {
            $set: {
                "adminId": ObjectId(admin._id),
                "email": admin.email,
                "password": admin.password,
                "createdAt": new Date(),
                "userToken": userToken,
                "settings": admin.settings,
                "profiles": admin.profiles
            }
        }, {upsert: true, new: true}, function (err, session) {

            if (err) {
                console.log("Error finding session for admin Id: " + admin._id + ", err: " + JSON.stringify(err));
                callback(new excptions.GeneralError(500));
                return;
            }
            callback(null, dbHelper, session.value);
        })
}

//Logout (remove session)
function logout(dbHelper, token, password, callback) {
    var sessionsCollection = dbHelper.getCollection("Sessions");
    sessionsCollection.findOne({
        "userToken": token
    }, {}, function (err, session) {
        if (err || !session) {
            callback(new excptions.GeneralError(401));
            return;
        }

        var validToLogout = false;
        if (session.settings.passwordProtected == false) {
            validToLogout = true;
        }
        else if (session.settings.passwordProtected == true && password && session.password == md5(password + "|" + session.email)) {
            validToLogout = true;
        }

        if (validToLogout == false) {
            callback(new excptions.GeneralError(500)); //Client tries to hack with a wrong password
            return;
        }

        //Actual logout - remove the session
        sessionsCollection.remove(
            {
                "userToken": token
            }
            , {w: 1, single: true},
            function (err, numberOfRemovedDocs) {
                if (err || numberOfRemovedDocs == 0) {
                    //Session does not exist - stop the call chain
                    callback(new excptions.GeneralError(401)); //Will cause the client to re-login
                    return;
                }

                callback(null, dbHelper);
            }
        )
    })
}

function getSessionResponse(session) {
    return {
        "token": session.userToken,
        "settings": session.settings,
        "profiles": session.profiles
    };
}