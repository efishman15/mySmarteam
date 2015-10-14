var exceptions = require("../utils/exceptions");
var generalUtils = require("../utils/general");
var Leaderboard = require("agoragames-leaderboard");
var logger = require("../utils/logger");
var async = require("async");
var sessionUtils = require("./session");
var dalLeaderboards = require("../dal/dalLeaderboards");
var dalFacebook = require("../dal/dalFacebook");
var dalDb = require("../dal/dalDb");

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

    getLeaders(data, function (err, data) {
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
    var data = {"token": token};

    data.leaderboard = dalLeaderboards.getWeeklyLeaderboard();

    getLeaders(data, function (err, data) {
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
// data: friendsPermissionJustGranted (optional boolean)
//--------------------------------------------------------------------------
module.exports.getFriends = function (req, res, next) {

    var token = req.headers.authorization;
    var data = req.body;
    data.token = token;

    var operations = [

        //getSession
        function (callback) {
            sessionUtils.getSession(data, callback);
        },

        //If no permission for friends - 2 cases:
        //1. User "just granted" the permission - give another try to facebook to validate that and retrieve user friends
        //2. User did not just grant - return with an error message to the client to ask for the permission
        function (data, callback) {
            if (data.session.friends.noPermission) {
                if (!data.friendsPermissionJustGranted) {
                    callback(new exceptions.ServerMessageException("SERVER_ERROR_MISSING_FRIENDS_PERMISSION"));
                    return;
                }
                else {
                    //User just granted - try to retrieve user friends again from facebook
                    data.user = {"thirdParty": {"accessToken": data.session.facebookAccessToken}};
                    dalFacebook.getUserFriends(data, callback);
                }
            }
            else {
                callback(null, data);
            }

        },

        //If no permission and permission was just granted - store the session with the friends just retrived
        function (data, callback) {
            if (data.session.friends.noPermission && data.friendsPermissionJustGranted) {

                data.session.friends = data.user.thirdParty.friends;

                //Still no luck - user gave no permission
                if (data.session.friends.noPermission) {
                    callback(new exceptions.ServerMessageException("SERVER_ERROR_MISSING_FRIENDS_PERMISSION"));
                    return;
                }
                else {
                    dalDb.storeSession(data, callback);
                }
            }
            else {
                callback(null, data);
            }
        },

        //If permission was just granted - store it in the user's profile as well
        function (data, callback) {
            if (data.friendsPermissionJustGranted) {
                data.setData = {"friends": data.session.friends};
                data.closeConnection = true;
                dalDb.setUser(data, callback);
            }
            else {
                dalDb.closeDb(data);
                callback(null, data);
            }
        },

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
