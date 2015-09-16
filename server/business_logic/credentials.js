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

//----------------------------------------------------------------------------------------------------------------------------------------------------
// fbcanvas
//
// Comming from facebook canvas post
//
// data: signed_request
//
// The signed_request is used only to verify if the user is logged in and
// has authorized the app.
// In both cases server redirects to client "/fb" route state with 2 states:
// 1. connected=true - the signed request is also sent back to the client and client will authenticate our server again with this signed request.
// 2. connected=false - "standard" scenario using client JS SDK to authenticate to facebook
//----------------------------------------------------------------------------------------------------------------------------------------------------
module.exports.fbcanvas = function (req, res, next) {
    var data = req.body;
    var verifier = new dalFacebook.SignedRequest(generalUtils.settings.server.facebook.secretKey, data.signed_request);
    if (verifier.verify === false) {
        new exceptions.ServerResponseException(res, "Invalid signed request received from facebook", {"facebookData" : data});
        return;
    }

    var redirectUrl = generalUtils.settings.server.facebook.signedRequestRedirectUrl;
    var language = generalUtils.getLanguageByCountryCode(verifier.data.user.country.toUpperCase())
    redirectUrl += "?signedRequest=" + data.signed_request + "&language=" + language;
    if (verifier.data.oauth_token) {
        redirectUrl += "&connected=true";
    }
    else {
        redirectUrl += "&connected=false";
    }
    res.redirect(redirectUrl);
}

//----------------------------------------------------------------------------------------------------------------------------------------------------
// fbPayments
//
// Comming from facebook payments
//
// data:
//----------------------------------------------------------------------------------------------------------------------------------------------------
module.exports.fbPayments = function (req, res, next) {
    console.log("incoming fb payments request!");
    res.send(200, req.query["hub.challenge"]);
}


