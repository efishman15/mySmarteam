var path = require("path");
var exceptions = require(path.resolve(__dirname,"../utils/exceptions"));
var generalUtils = require(path.resolve(__dirname,"../utils/general"));
var logger = require(path.resolve(__dirname,"../utils/logger"));
var async = require("async");
var sessionUtils = require(path.resolve(__dirname,"./session"));
var dalDb = require(path.resolve(__dirname,"../dal/dalDb"));

//--------------------------------------------------------------------------
// clearCache
//
// data: <NA>
//--------------------------------------------------------------------------
module.exports.clearCache = function (req, res, next) {

    var token = req.headers.authorization;
    var data = req.body;

    var operations = [

        //getAdminSession
        function (callback) {
            data.token = token;
            sessionUtils.getAdminSession(data, callback);
        },

        //Reload settings from database
        function (data, callback) {
            data.closeConnection = true;
            dalDb.loadSettings(data, callback);
        },

        //Inject the settings back to memory
        function (data, callback) {
            generalUtils.injectSettings(data.settings);
            callback(null, data);
        }
    ];

    async.waterfall(operations, function (err) {
        if (!err) {
            res.json(data.settings.client);
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};

//--------------------------------------------------------------------------
// restart
//
// data: <NA>
//--------------------------------------------------------------------------
module.exports.restart = function (req, res, next) {

    var token = req.headers.authorization;
    var data = req.body;
    data.token = token;
    data.closeConnection = true;

    sessionUtils.getAdminSession(data, function(err, data) {

        if (err) {
            res.send(err.httpStatus, err);
            return;
        }

        res.send(200, "OK");
        res.end();

        logger.server.info({"user" : data.session.name}, "Restarting server per admins request");

        //Forever module will take care of restarting the process again
        setTimeout(function() {
            process.exit(1);
        }, 3000);
    });
};
