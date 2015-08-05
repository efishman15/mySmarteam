var async = require('async');
var dal = require('../dal/myMongoDB');
var exceptions = require('../utils/exceptions');
var ObjectId = require('mongodb').ObjectID;
var md5 = require("MD5");

//----------------------------------------------------
// retrieveSession
//----------------------------------------------------
function retrieveSession(dbHelper, token, callback) {
    var sessionsCollection = dbHelper.getCollection("Sessions");
    sessionsCollection.findOne(
        {
            "userToken": token
        }
        , {},
        function (err, session) {
            if (err || !session) {
                //Session does not exist - stop the call chain
                console.log("error finding session with token: " + token, "error: " + err);
                callback(new exceptions.GeneralError(401, "Session expired"));
                return;
            }

            callback(null, dbHelper, session);
        }
    )
};
module.exports.retrieveSession = retrieveSession;

//----------------------------------------------------
// getSession
//----------------------------------------------------
module.exports.getSession = function (token, callback) {

    var operations = [

        //Connect to the database
        dal.connect,

        //Register the new admin
        function (dbHelper, callback) {
            retrieveSession(dbHelper, token, callback);
        }
    ];

    async.waterfall(operations, function (err, dbHelper, session) {
        if (!err) {
            callback(null, dbHelper, session);
        }
        else {
            callback(err);
        }
    });
};

//----------------------------------------------------
// storeSession
//----------------------------------------------------
function storeSession(dbHelper, session, callback) {
    var sessionsCollection = dbHelper.getCollection("Sessions");
    sessionsCollection.update(
        {
            "_id": session._id
        },
        session,
        function (err, updated) {
            if (err) {
                //Session does not exist - stop the call chain
                console.log("error finding session with token: " + token, "error: " + err);
                callback(new exceptions.GeneralError(401, "Session expired"));
                return;
            }

            callback(null, dbHelper, session);
        }
    )
};
module.exports.storeSession = storeSession;

//----------------------------------------------------
// saveSettings
//----------------------------------------------------
module.exports.saveSettings = function (req, res, next) {
    var serverData = req.body;
    var token = req.headers.authorization;

    var operations = [

        //Connect to the database
        dal.connect,

        //Retrieve the session
        function (dbHelper, callback) {
            retrieveSession(dbHelper, token, callback);
        },

        //Validate that settings can be saved - if are password protected
        function(dbHelper, session, callback) {
            var validToSave = false;
            if (session.settings.passwordProtected == false) {
                validToSave = true;
            }
            else if (session.settings.passwordProtected == true && serverData.password && session.password == md5(serverData.password + "|" + session.email)) {
                validToSave = true;
            }

            if (validToSave == false) {
                callback(new excptions.GeneralError(500)); //Client tries to hack with a wrong password
                return;
            }

            callback(null, dbHelper, session);
        },

        //Update the session in db
        function (dbHelper, session, callback) {
            session.settings = serverData.settings;
            storeSession(dbHelper, session, callback);
        },

        //Update the admin in db
        function (dbHelper, session, callback) {
            var adminsCollection = dbHelper.getCollection('Admins');
            adminsCollection.findAndModify({"_id": ObjectId(session.adminId)}, {},
                {
                    $set: {
                        "settings": serverData.settings
                    }
                }, {}, function (err, admin) {

                    if (err) {
                        console.log("Error finding admin with Id: " + session.adminId + ", err: " + JSON.stringify(err));
                        callback(new exceptions.GeneralError(500));
                        return;
                    }
                    callback(null, dbHelper);
                })
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
    });
};

//----------------------------------------------------
// confirmPassword
//----------------------------------------------------
module.exports.confirmPassword = function (req, res, next) {
    var password = req.body.password;
    var token = req.headers.authorization;

    var operations = [

        //Connect to the database
        dal.connect,

        //Retrieve the session
        function (dbHelper, callback) {
            retrieveSession(dbHelper, token, callback);
        },

        //get the adminId from session and compare his password

        function (dbHelper, session, callback) {
            var adminsCollection = dbHelper.getCollection("Admins");
            adminsCollection.findOne({
                "email": session.email,
                "password": md5(password + "|" + session.email)
            }, {}, function (err, admin) {
                if (err || !admin) {
                    callback(null, dbHelper, false);
                    return;
                }

                callback(null, dbHelper, true);
            })
        },

        //Close the db
        function (dbHelper, confirmed, callback) {
            dbHelper.close();
            callback(null, confirmed);
        }
    ];

    async.waterfall(operations, function (err, confirmed) {
        if (!err) {
            res.json({"confirmed": confirmed});
        }
        else {
            res.send(err.status, err);
        }
    });
};
