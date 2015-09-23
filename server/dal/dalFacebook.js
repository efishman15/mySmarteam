var FACEBOOK_GRAPH_DOMAIN = "graph.facebook.com";
var FACEBOOK_GRAPH_URL = "https://" + FACEBOOK_GRAPH_DOMAIN;
var https = require("https");
var exceptions = require('../utils/exceptions');
var crypto = require('crypto');
var generalUtils = require('../utils/general');
var querystring = require("querystring");

//---------------------------------------------------------------------------------------------------------------------------------
// getUserInfo
//
// Validates facebook access token and makes sure it matches the input user id
//
// data:
// -----
// input: user (contains thirdParty.accessToken + thirdParty.id OR thirdParty.signedRequest if in canvas)
// output: user.avatar, user.name, user.email, user.ageRange, user.thirdParty.payment_mobile_pricepoints (in case of canvas)
//---------------------------------------------------------------------------------------------------------------------------------
module.exports.getUserInfo = function (data, callback) {

    var fields = "id,name,email,age_range";

    var facebookResponse = "";

    if (data.user.thirdParty.signedRequest) {
        //Coming from canvas
        var verifier = new SignedRequest(generalUtils.settings.server.facebook.secretKey, data.user.thirdParty.signedRequest);
        if (!verifier.verify) {
            callback(new exceptions.ServerException("Invalid signed request received from facebook", {"signedRequest": data.signedRequest}));
            return;
        }

        data.user.thirdParty.accessToken = verifier.data.oauth_token;
        data.user.thirdParty.id = verifier.data.user_id;
        fields += ",payment_mobile_pricepoints,currency";
    }

    var req = https.get(FACEBOOK_GRAPH_URL + "/me?fields=" + fields + "&access_token=" + data.user.thirdParty.accessToken, function (res) {

        res.setEncoding("utf8");

        res.on('data', function (chunk) {
            facebookResponse += chunk;
        });

        res.on('end', function () {

            var facebookData = JSON.parse(facebookResponse);
            if (facebookData && facebookData.id) {
                if (facebookData.id === data.user.thirdParty.id) {
                    data.user.avatar = getUserAvatar(data.user.thirdParty.id);
                    data.user.name = facebookData.name;
                    data.user.email = facebookData.email; //might be null if user removed
                    data.user.ageRange = facebookData.age_range;
                    if (facebookData.payment_mobile_pricepoints) {
                        data.user.thirdParty.paymentMobilePricepoints = facebookData.payment_mobile_pricepoints;
                        data.user.thirdParty.currency = facebookData.currency;
                    }
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
    });

    req.on("error", function (error) {
        callback(new exceptions.ServerException("Error recevied from facebook while validating access token", {
            "facebookAccessToken": data.user.thirdParty.accessToken,
            "error": error
        }));
    });

    req.end();
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

//---------------------------------------------------------------------------------------------------------------------------------
// getPaymentInfo
//
// Retrieves payment info from facebook using the app access token
//
// data:
// -----
// input: paymentId
// output: paymentData, featurePurchased, facebookUserId
//---------------------------------------------------------------------------------------------------------------------------------
module.exports.getPaymentInfo = function (data, callback) {

    var fields = "id,actions,items,disputes,request_id,user";

    var facebookResponse = "";

    var url = FACEBOOK_GRAPH_URL + "/" + data.paymentId + "?fields=" + fields + "&access_token=" + generalUtils.settings.server.facebook.appAccessToken;
    var req = https.get(url, function (res) {

        res.setEncoding("utf8");

        res.on('data', function (chunk) {
            facebookResponse += chunk;
        });

        res.on('end', function () {

            var facebookData = JSON.parse(facebookResponse);

            //request_id in the format: "featureName|facebookUserId|timeStamp"
            var requestIdParts = facebookData.request_id.split("|");

            if (data.purchaseData && data.purchaseData.signed_request) {
                var verifier = new SignedRequest(generalUtils.settings.server.facebook.secretKey, data.purchaseData.signed_request);
                if (!verifier.verify) {
                    callback(new exceptions.ServerException("Invalid signed request received from facebook", {"signedRequest": data.signedRequest}));
                    return;
                }

                if (verifier.data.request_id !== facebookData.request_id) {
                    callback(new exceptions.ServerException("Error validating payment, payment belongs to someone else", {
                        "facebookData": facebookData,
                        "verifier.data": verifier.data,
                        "paymentFacebookId": requestIdParts[1]
                    }));
                    return;
                }
            }

            data.paymentData = facebookData;
            data.paymentData.clientTimestamp = parseInt(requestIdParts[2], 10);
            data.featurePurchased = requestIdParts[0];
            data.facebookUserId = requestIdParts[1];

            if (!data.thirdPartyServerCall || data.entry[0].changed_fields.contains("actions")) {
                //Coming from facebook server notification
                var lastAction = facebookData.actions[facebookData.actions.length - 1];

                data.paymentData.status = lastAction.type + "." + lastAction.status;

                if (lastAction.type === "charge") {
                    if (lastAction.status === "completed") {
                        data.proceedPayment = true;
                    }
                }
                else {
                    //refund, chargeback, decline
                    data.revokeAsset = true;
                }
            }

            if (data.thirdPartyServerCall) {

                if (data.entry[0].changed_fields.contains("disputes")) {
                    var lastDispute = facebookData.disputes[facebookData.disputes.length - 1];

                    data.paymentData.status = "dispute." + lastDispute.status;

                    if (lastDispute.status === "pending") {
                        data.dispute = true;
                        for (var i = 0; i < facebookData.actions.length; i++) {
                            if (facebookData.actions[i].type === "charge" && facebookData.actions[i].status === "completed") {
                                data.itemCharged = true;
                            }
                        }
                    }
                }
            }

            callback(null, data);
        });
    });

    req.on("error", function (error) {
        callback(new exceptions.ServerException("Error recevied from facebook while retrieving payment id", {
            "paymentId": data.paymentId,
            "error": error
        }));
    });

    req.end();
};

//---------------------------------------------------------------------------------------------------------------------------------
// denyDispute
//
// posts to facebook a deny for a dispute using the app access token
//
// data:
// -----
// input: paymentId
// output: na
//---------------------------------------------------------------------------------------------------------------------------------
module.exports.denyDispute = function (data, callback) {

    var fields = "id,actions,items,disputes,request_id";

    var facebookResponse = "";

    var postData = querystring.stringify({
            "access_token": generalUtils.settings.server.facebook.appAccessToken,
            "reason": "DENIED_REFUND"
        }
    )

    var options = {
        host: FACEBOOK_GRAPH_DOMAIN,
        port: 443,
        path: data.paymentId + "/dispute",
        method: "POST",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    };

    var req = https.request(options, function (res) {

        res.setEncoding("utf8");

        res.on('data', function (chunk) {
            facebookResponse += chunk;
        });

        res.on('end', function () {

            var facebookData = JSON.parse(facebookResponse);
            if (!facebookData || !facebookData.success) {
                callback(new exceptions.ServerException("Error recevied from facebook while disputing payment id", {
                    "paymentId": data.paymentId,
                    "facebookResponse": facebookResponse
                }));
            }

            callback(null, data);
        });
    });

    req.on("error", function (error) {
        callback(new exceptions.ServerException("Error recevied from facebook while disputing payment id", {
            "paymentId": data.paymentId,
            "error": error
        }));
    });

    req.write(postData);

    req.end();
};
