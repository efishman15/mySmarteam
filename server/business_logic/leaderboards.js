var exceptions = require("../utils/exceptions");
var generalUtils = require("../utils/general");
var Leaderboard = require("agoragames-leaderboard");
var logger = require("../utils/logger");
var async = require("async");
var sessionUtils = require("./session");
var dalLeaderboards = require("../dal/dalLeaderboards");
var dalFacebook = require("../dal/dalFacebook");

//--------------------------------------------------------------------------
// private functions
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// getLeaders
// input: data.leaderboard
// output data.clientResponse
//--------------------------------------------------------------------------
function getLeaders(data, callback) {

    var operations = [

        //getSession
        function (callback) {
            data.closeConnection = true;
            sessionUtils.getSession(data, callback);
        },

        dalLeaderboards.getLeaders
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            callback(null, data);
        }
        else {
            callback(err, data);
        }
    });
}

//--------------------------------------------------------------------------
// getContestLeaders
//
// data: contestId, teamId (optional)
//--------------------------------------------------------------------------
module.exports.getContestLeaders = function (req, res, next) {

    var token = req.headers.authorization;
    var data = req.body;
    data.token = token;

    if (!data.contestId) {
        exceptions.ServerResponseException(res, "contestId not supplied", null, "warn", 424);
        return;
    }

    if (data.teamId != null && data.teamId !== 0 && data.teamId !== 1) {
        exceptions.ServerResponseException(res, "invalid teamId supplied", {"teamId": data.teamId}, "warn", 424);
        return;
    }

    if (data.teamId === 0 || data.teamId === 1) {
        data.leaderboard = dalLeaderboards.getTeamLeaderboard(data.contestId, data.teamId);
    }
    else {
        data.leaderboard = dalLeaderboards.getContestLeaderboard(data.contestId);
    }

    getLeaders(data, function(err, data) {
        if (!err) {
            res.send(200, data.clientResponse);
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};

//--------------------------------------------------------------------------
// getWeeklyLeaders
//
// data: <NA>
//--------------------------------------------------------------------------
module.exports.getWeeklyLeaders = function (req, res, next) {

    var token = req.headers.authorization;
    var data = {"token" : token};

    data.leaderboard = dalLeaderboards.getWeeklyLeaderboard();

    getLeaders(data, function(err, data) {
        if (!err) {
            res.send(200, data.clientResponse);
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};

//--------------------------------------------------------------------------
// getFriends
//
// data: <NA>
//--------------------------------------------------------------------------
module.exports.getFriends = function (req, res, next) {

    var token = req.headers.authorization;
    var data = {"token" : token};

    var operations = [

        //getSession
        function (callback) {
            data.closeConnection = true;
            sessionUtils.getSession(data, callback);
        },

        dalFacebook.getUserFriends,

        dalLeaderboards.getFriends

    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.send(200, data.clientResponse)
        }
        else {
            res.send(err.httpStatus, err);
        }
    })
};
