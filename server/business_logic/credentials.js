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
        "facebookAccessToken": session.facebookAccessToken,
        "avatar": session.avatar,
        "name": session.name,
        "settings": session.settings
    };
}

//--------------------------------------------------------------------------
// facebookConnect
//
// data: facebookAccessToken, facebookUserId, settings (optional)
//--------------------------------------------------------------------------
module.exports.facebookConnect = function (req, res, next) {
    var data = req.body;
    var operations = [

        //Validate token
        function (callback) {
            dalFacebook.getUserInfo(data, callback);
        },

        dalDb.facebookLogin,

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
