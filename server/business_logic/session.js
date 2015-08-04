// Retrieve
var async = require('async');
var dal = require('../dal/myMongoDB');
var exceptions = require('../utils/exceptions');
var ObjectId = require('mongodb').ObjectID;
var generalUtils = require('../utils/general');

module.exports.getSession = function (token, callback) {

    var operations = [

        //Connect to the database
        dal.connect,

        //Register the new admin
        function (dbHelper, callback) {
            retrieveSession(dbHelper, token, callback);
        },
    ];

    async.waterfall(operations, function (err, dbHelper, session) {
        if (!err) {
            callback(null, dbHelper, session);
        }
        else {
            callback(err);
        }
    });
}

module.exports.storeSession = storeSession;

//Retrieve Session
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
            ;
            callback(null, dbHelper, session);
        }
    )
};

module.exports.saveSettings = function (req, res, next) {
    var settings = req.body;
    var token = req.headers.authorization;

    var operations = [

        //Connect to the database
        dal.connect,

        //Retrieve the session
        function (dbHelper, callback) {
            retrieveSession(dbHelper, token, callback);
        },

        //Update the session in db
        function (dbHelper, session, callback) {
            session.settings = settings;
            storeSession(dbHelper, session, callback);
        },

        //Update the admin in db
        function (dbHelper, session, callback) {
            var adminsCollection = dbHelper.getCollection('Admins');
            adminsCollection.findAndModify({"_id": ObjectId(session.adminId)}, {},
                {
                    $set: {
                        "settings": settings
                    }
                }, {}, function (err, admin) {

                    if (err) {
                        console.log("Error finding admin with Id: " + session.adminId + ", err: " + JSON.stringify(err));
                        callback(new excptions.GeneralError(500));
                        return;
                    }
                    callback(null, dbHelper, session);
                })
        },

        //Close the db
        function (dbHelper, session, callback) {
            dbHelper.close();
            callback(null, session);
        }
    ]

    async.waterfall(operations, function (err, session) {
        if (!err) {
            res.send(200, "OK");
        }
        else {
            res.send(err.status, err);
        }
    });
}


//Retrieve Session
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
            ;
            callback(null, dbHelper, session);
        }
    )
};