var async = require('async');
var dalDb = require('../dal/dalDb');
var dalFacebook = require('../dal/dalFacebook');
var exceptions = require('../utils/exceptions');

//--------------------------------------------------------------------------
// private functions
//--------------------------------------------------------------------------
function getSessionResponse(session) {
    return {
        "token": session.userToken,
        "thirdParty" : {"id" : session.facebookUserId, "accessToken" : session.facebookAccessToken, "type" : "facebook"},
        "isAdmin" : session.isAdmin,
        "avatar": session.avatar,
        "name": session.name,
        "settings": session.settings
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

        //Create/Update session
        function (data, callback) {
            data.closeConnection = true;
            dalDb.createOrUpdateSession(data, callback);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(getSessionResponse(data.session))
        }
        else {
            res.send(err.status, err);
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
            res.send(err.status, err);
        }
    })
};
