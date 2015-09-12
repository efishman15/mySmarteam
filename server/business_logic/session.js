var async = require("async");
var dalDb = require("../dal/dalDb");
var exceptions = require("../utils/exceptions");
var generalUtils = require("../utils/general");

//----------------------------------------------------
// getSession

// data
//
// data:
// input: token
// output: session
//----------------------------------------------------
module.exports.getSession = function (data, callback) {

    var operations = [

        //Connect to the database (so connection will stay open until we decide to close it)
        dalDb.connect,

        function(connectData, callback) {
            data.DbHelper = connectData.DbHelper;
            dalDb.retrieveSession(data, callback);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            callback(null, data);
        }
        else {
            callback(err);
        }
    });
};

//----------------------------------------------------
// saveSettings
//
// data: settings
//----------------------------------------------------
module.exports.saveSettings = function (req, res, next) {

    var data = req.body;
    var token = req.headers.authorization;

    var operations = [

        //Connect to the database
        dalDb.connect,

        //Retrieve the session
        function(connectData, callback) {
            data.DbHelper = connectData.DbHelper;
            data.token = token;
            dalDb.retrieveSession(data, callback);
        },

        //Store the session back
        function(data, callback) {
            data.session.settings = data.settings;
            dalDb.storeSession(data, callback);
        },

        //Save the settings to the user object
        function(data, callback) {
            data.setData = {"settings" : data.session.settings};
            data.closeConnection = true;
            dalDb.setUser(data, callback);
        }
    ];

    async.waterfall(operations, function (err) {
        if (!err) {
            res.send(200, "OK");
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};

//----------------------------------------------------
// Toggle Sound
//----------------------------------------------------
module.exports.toggleSound = function (req, res, next) {

    var token = req.headers.authorization;

    var operations = [

        //Connect to the database
        dalDb.connect,

        //Retrieve the session
        function(data, callback) {
            data.token = token;
            dalDb.retrieveSession(data, callback);
        },

        //Store the session back
        function(data, callback) {
            data.session.settings.sound = !data.session.settings.sound
            dalDb.storeSession(data, callback);
        },

        //Save the settings to the user object
        function(data, callback) {
            data.setData = {"settings.sound" : data.session.settings.sound};
            data.closeConnection = true;
            dalDb.setUser(data, callback);
        }

    ];

    async.waterfall(operations, function (err) {
        if (!err) {
            res.send(200, "OK");
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};

//---------------------------------------------------------------------------------
// computeFeatures
//
// Can receive either user object or session object.

// Runs through the available features in settings
// and computes lock state, cost, currency and unlockRank, lockText, unlockText
//
// returns: the computed feature list
//---------------------------------------------------------------------------------
module.exports.computeFeatures = function(userOrSession) {

    var features = {};
    for (var property in generalUtils.settings.server.features) {
        if (generalUtils.settings.server.features.hasOwnProperty(property)) {
            features[property] = {};
            var serverFeature = generalUtils.settings.server.features[property];
            features[property].name = serverFeature.name;
            features[property].lockText = serverFeature.lockText;
            features[property].unlockText = serverFeature.unlockText;
            features[property].unlockRank = serverFeature.unlockRank;
            features[property].purchaseData = generalUtils.settings.server.purchaseProducts[serverFeature.purchaseProductId];

            switch (property) {
                case "newContest":
                    features[property].locked = !(userOrSession.isAdmin === true) &&
                        userOrSession.rank <  serverFeature.unlockRank &&
                        (!userOrSession.assets || !userOrSession.assets[property])
                    break;
                case "challengeFriendContest":
                    features[property].locked = true;
            }
        }
    }

    return features;
}
