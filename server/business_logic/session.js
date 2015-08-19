var async = require("async");
var dalDb = require("../dal/dalDb");
var exceptions = require("../utils/exceptions");

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
            data.dbHelper = connectData.dbHelper;
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
            data.dbHelper = connectData.dbHelper;
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
            res.send(err.status, err);
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
            data.setData = {"settings" : data.session.settings};
            data.closeConnection = true;
            dalDb.saveUserSettings(data, callback);
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
