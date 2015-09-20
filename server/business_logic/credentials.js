var async = require('async');
var dalDb = require('../dal/dalDb');
var dalFacebook = require('../dal/dalFacebook');
var exceptions = require('../utils/exceptions');
var generalUtils = require('../utils/general');
var sessionUtils = require("./session");

//--------------------------------------------------------------------------
// private functions
//--------------------------------------------------------------------------
function getSessionResponse(session) {
    return {
        "token": session.userToken,
        "thirdParty": {"id": session.facebookUserId, "accessToken": session.facebookAccessToken, "type": "facebook"},
        "isAdmin": session.isAdmin,
        "avatar": session.avatar,
        "name": session.name,
        "score": session.score,
        "rank": session.rank,
        "xpProgress": new generalUtils.XpProgress(session.xp, session.rank),
        "settings": session.settings,
        "features": session.features
    };
}

//--------------------------------------------------------------------------
// facebookConnect
//
// data: user (should contain user.thirdParty (id, type, accessToken)
//--------------------------------------------------------------------------
module.exports.facebookConnect = function (req, res, next) {
    var data = req.body;

    var operations = [

            //Validate token
            function (callback) {
                dalFacebook.getUserInfo(data, callback);
            },

            //Open db connection
            function (data, callback) {
                dalDb.connect(callback);
            },

            //Try to login (or register) with the facebook info supplied
            function (connectData, callback) {
                data.DbHelper = connectData.DbHelper;
                dalDb.facebookLogin(data, callback)
            },

            //Compute features and create/update session
            function (data, callback) {
                data.features = sessionUtils.computeFeatures(data.user);
                data.closeConnection = true;
                dalDb.createOrUpdateSession(data, callback);
            }
        ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(getSessionResponse(data.session))
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};

//--------------------------------------------------------------------------
// facebookConnect
//
// data: token
//--------------------------------------------------------------------------
module.exports.logout = function (req, res, next) {
    var token = req.headers.authorization;

    var operations = [

        //Connect
        dalDb.connect,

        //Logout
        function (data, callback) {
            data.token = token;
            data.closeConnection = true;
            dalDb.logout(data, callback);
        }
    ];

    async.waterfall(operations, function (err) {
        if (!err) {
            res.send(200, "OK");
        }
        else {
            res.send(err.httpStatus, err);
        }
    })
};
