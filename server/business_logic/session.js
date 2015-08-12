var async = require('async');
var dal = require('../dal/myMongoDB');
var exceptions = require('../utils/exceptions');
var ObjectId = require('mongodb').ObjectID;
var uuid = require('node-uuid');
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
                console.log("error finding session with token: " + session._id, "error: " + err);
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
    var postData = req.body;
    var token = req.headers.authorization;

    var operations = [

        //Connect to the database
        dal.connect,

        //Retrieve the session
        function (dbHelper, callback) {
            retrieveSession(dbHelper, token, callback);
        },

        //Validate that settings can be saved - if are password protected
        function (dbHelper, session, callback) {
            checkPassword(dbHelper, session, postData.password, callback);
        },

        //Update the session in db
        function (dbHelper, session, callback) {
            session.settings = postData.settings;
            storeSession(dbHelper, session, callback);
        },

        //Update the admin in db
        function (dbHelper, session, callback) {
            var adminsCollection = dbHelper.getCollection('Admins');
            adminsCollection.findAndModify({"_id": ObjectId(session.adminId)}, {},
                {
                    $set: {
                        "settings": postData.settings
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
// setProfile
//----------------------------------------------------
module.exports.setProfile = function (req, res, next) {
    var postData = req.body;
    var token = req.headers.authorization;

    var operations = [

        //Connect to the database
        dal.connect,

        //Retrieve the session
        function (dbHelper, callback) {
            retrieveSession(dbHelper, token, callback);
        },

        //Validate that settings can be saved - if are password protected
        function (dbHelper, session, callback) {
            checkPassword(dbHelper, session, postData.password, callback);
        },

        //Update the session with the new profile
        function (dbHelper, session, callback) {
            if (!postData.profile.id) {
                //mode=add
                postData.profile.id = uuid.v1();
            }
            session.profiles[postData.profile.id] = postData.profile;
            storeSession(dbHelper, session, callback);
        },

        setAdminProfiles,

        //Close the db
        function (dbHelper, callback) {
            dbHelper.close();
            callback(null);
        }
    ];

    async.waterfall(operations, function (err) {
        if (!err) {
            res.json(postData.profile);
        }
        else {
            res.send(err.status, err);
        }
    });
};

//----------------------------------------------------
// setProfile
//----------------------------------------------------
module.exports.toggleSound = function (req, res, next) {
    var token = req.headers.authorization;

    var operations = [

        //Connect to the database
        dal.connect,

        //Retrieve the session
        function (dbHelper, callback) {
            retrieveSession(dbHelper, token, callback);
        },

        //Update the session after toggle sound
        function (dbHelper, session, callback) {
            session.profiles[session.settings.profileId].sound = !session.profiles[session.settings.profileId].sound
            storeSession(dbHelper, session, callback);
        },

        setAdminProfiles,

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
// removeProfile
//----------------------------------------------------
module.exports.removeProfile = function (req, res, next) {
    var postData = req.body;
    var token = req.headers.authorization;

    var operations = [

        //Connect to the database
        dal.connect,

        //Retrieve the session
        function (dbHelper, callback) {
            retrieveSession(dbHelper, token, callback);
        },

        //Validate that settings can be saved - if are password protected
        function (dbHelper, session, callback) {
            checkPassword(dbHelper, session, postData.password, callback);
        },

        //Remove this profile from session
        function (dbHelper, session, callback) {
            if (Object.keys(session.profiles).length == 1) {
                console.log("trying to delete the last profile of admin: " + session.adminId + ", profile Id: " + postData.profileId);
                callback(new exceptions.GeneralError(500));
                return;
            }
            if (!session.profiles[postData.profileId]) {
                console.log("trying to delete a non existing profile of admin: " + session.adminId + ", profile Id: " + postData.profileId);
                callback(new exceptions.GeneralError(500));
                return;
            }
            else {
                delete session.profiles[postData.profileId];
                //If deleting the current session's profile - point to the first profile left
                if (session.settings.profileId == postData.profileId) {
                    session.settings.profileId = Object.keys(session.profiles)[0];
                }
            }
            storeSession(dbHelper, session, callback);
        },

        setAdminProfiles,

        //Close the db
        function (dbHelper, callback) {
            dbHelper.close();
            callback(null);
        }
    ];

    async.waterfall(operations, function (err) {
        if (!err) {
            res.json(postData.profile);
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
    if (!password) {
        res.send(new exceptions.GeneralError(424));
    }

    var token = req.headers.authorization;

    var operations = [

        //Connect to the database
        dal.connect,

        //Retrieve the session
        function (dbHelper, callback) {
            retrieveSession(dbHelper, token, callback);
        },

        //Compare the password to the session
        function (dbHelper, session, callback) {
            if (session.password != md5(password + "|" + session.email)) {
                callback(null, dbHelper, false);
                return;
            }
            callback(null, dbHelper, true);
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

function checkPassword(dbHelper, session, password, callback) {
    var validToSave = false;
    if (session.settings.passwordProtected == false) {
        validToSave = true;
    }
    else if (session.settings.passwordProtected == true && password && session.password == md5(password + "|" + session.email)) {
        validToSave = true;
    }

    if (validToSave == false) {
        callback(new exceptions.GeneralError(500)); //Client tries to hack with a wrong password
        return;
    }

    callback(null, dbHelper, session);
}


function setAdminProfiles(dbHelper, session, callback) {
    var adminsCollection = dbHelper.getCollection('Admins');
    adminsCollection.findAndModify({"_id": ObjectId(session.adminId)}, {},
        {
            $set: {
                "profiles": session.profiles
            }
        }, {}, function (err, admin) {

            if (err) {
                console.log("Error finding admin with Id: " + session.adminId + ", err: " + JSON.stringify(err));
                callback(new exceptions.GeneralError(500));
                return;
            }
            callback(null, dbHelper);
        })
}
module.exports.setAdminProfiles = setAdminProfiles;