// Retrieve
var async = require('async');
var dal = require('../dal/myMongoDB');
var excptions = require('../business_logic/exceptions');

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
                callback(new excptions.GeneralError(401, "Session expired"));
                return;
            }
            ;
            callback(null, dbHelper, session);
        }
    )
};


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
                callback(new excptions.GeneralError(401, "Session expired"));
                return;
            }
            ;
            callback(null, dbHelper, session);
        }
    )
};