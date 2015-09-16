var FACEBOOK_GRAPH_URL = "https://graph.facebook.com";
var https = require("https");
var exceptions = require('../utils/exceptions');
var crypto = require('crypto');
var generalUtils = require('../utils/general');

//---------------------------------------------------------------------------------------------------------
// getUserInfo
//
// Validates facebook access token and makes sure it matches the input user id
//
// data:
// -----
// input: user (contains thirdParty.accessToken + thirdParty.id OR thirdParty.signedRequest if in canvas)
// output: avatar
//---------------------------------------------------------------------------------------------------------
module.exports.getUserInfo = function (data, callback) {

    if (data.user.thirdParty.signedRequest) {
        var verifier = new SignedRequest(generalUtils.settings.server.facebook.secretKey, data.user.thirdParty.signedRequest);
        if (verifier.verify === false) {
            new exceptions.ServerException("Invalid signed request received from facebook", {"signedRequest": data.signedRequest});
            return;
        }

        data.user.thirdParty.accessToken = verifier.data.oauth_token;
        data.user.thirdParty.id = verifier.data.user_id;
    }

    https.get(FACEBOOK_GRAPH_URL + "/me?fields=id,name,email,age_range&access_token=" + data.user.thirdParty.accessToken, function (res) {

        res.setEncoding('utf8');

        res.on('data', function (responseData) {

            var facebookData = JSON.parse(responseData);
            if (facebookData && facebookData.id) {
                if (facebookData.id === data.user.thirdParty.id) {
                    data.user.avatar = getUserAvatar(data.user.thirdParty.id);
                    data.user.name = facebookData.name;
                    data.user.email = facebookData.email; //might be null if user removed
                    data.user.ageRange = facebookData.age_range;
                    callback(null, data);
                }
                else {
                    callback(new exceptions.ServerException("Error validating facebook access token, token belongs to someone else", {
                        "facebookResponse": responseData,
                        "facebookAccessToken": data.user.thirdParty.accessToken,
                        "actualFacebookId": facebookData.id
                    }));
                    return;
                }
            }
            else {
                callback(new exceptions.ServerMessageException("SERVER_ERROR_INVALID_FACEBOOK_ACCESS_TOKEN", {
                    "facebookResponse": responseData,
                    "facebookAccessToken": data.user.thirdParty.accessToken
                }, 424));
                return;
            }

        });


    }).on('error', function (error) {
        callback(new exceptions.ServerException("Error recevied from facebook while validating access token", {
            "facebookAccessToken": data.user.thirdParty.accessToken,
            "error": error
        }));
    });
};

//-------------------------------------------------------------------------------------
// getUserAvatar
//
// Returns the facebook avatar
//-------------------------------------------------------------------------------------
module.exports.getUserAvatar = getUserAvatar;
function getUserAvatar(facebookUserId) {
    return "https://graph.facebook.com/" + facebookUserId + "/picture?type=square";
}

//-------------------------------------------------------------------------------------
// SignedRequest
//
// Returns the data behind facebook's signed request
//-------------------------------------------------------------------------------------
module.exports.SignedRequest = SignedRequest;

function SignedRequest(secret, request) {
    this.secret = secret;
    this.request = request;
    this.verify = this.verify.bind(this);

    var parts = this.request.split('.');
    this.encodedSignature = parts[0];
    this.encoded = parts[1];
    this.signature = this.base64decode(this.encodedSignature);
    this.decoded = this.base64decode(this.encoded);
    this.data = JSON.parse(this.decoded);

    return this;
}

SignedRequest.prototype.verify = function () {
    if (this.data.algorithm !== 'HMAC-SHA256') {
        return false;
    }
    var hmac = crypto.createHmac('SHA256', this.secret);
    hmac.update(this.encoded);
    var result = hmac.digest('base64').replace(/\//g, '_').replace(/\+/g, '-').replace(/\=/g, '');
    return result === this.encodedSignature;
};

SignedRequest.prototype.base64encode = function (data) {
    return new Buffer(data, 'utf8').toString('base64').replace(/\//g, '_').replace(/\+/g, '-').replace(/\=/g, '');
};

SignedRequest.prototype.base64decode = function (data) {
    while (data.length % 4 !== 0) {
        data += '=';
    }
    data = data.replace(/-/g, '+').replace(/_/g, '/');
    return new Buffer(data, 'base64').toString('utf-8');
};
