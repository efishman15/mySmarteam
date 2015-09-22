var sessionUtils = require("../business_logic/session");
var uuid = require("node-uuid");
var async = require('async');
var exceptions = require('../utils/exceptions');
var ObjectId = require("mongodb").ObjectID;
var dalDb = require('../dal/dalDb');
var dalFacebook = require('../dal/dalFacebook');
var generalUtils = require("../utils/general")
var PaypalObject = require('paypal-express-checkout').Paypal;
var paypal;
var paypalSettings;

PaypalObject.prototype.origParams = PaypalObject.prototype.params;
PaypalObject.prototype.params = function () {
    var myParams = paypal.origParams();
    myParams.SOLUTIONTYPE = "Sole";
    myParams.LANDINGPAGE = "Billing";
    myParams.VERSION = "124";
    return myParams;
};

//----------------------------------------------------
// payPalBuy
//
// data:
// input: feature, language
// output: url to surf to
//----------------------------------------------------
module.exports.payPalBuy = function (req, res, next) {

    if (!paypal) {
        paypalSettings = generalUtils.settings.server.payments.paypal;

        //returnUrl, cancelUrl will be set just before each buy
        paypal = require('paypal-express-checkout').init(paypalSettings.user, paypalSettings.password, paypalSettings.signature, "", "", paypalSettings.debug);
    }

    var token = req.headers.authorization;
    var data = req.body;

    if (!data.language) {
        exceptions.ServerResponseException(res, "Language not received during payPal buy", null, "warn", 424);
        return;
    }

    var operations = [

        //getSession
        function (callback) {
            data.token = token;
            sessionUtils.getSession(data, callback);
        },

        //Validate the payment transaction based on method
        function (data, callback) {

            //Invoice number will contain the product id which will be required later for validation
            var invoiceNumber = uuid.v1() + "_" + data.feature;

            var feature = generalUtils.settings.server.features[data.feature];
            if (!feature) {
                exceptions.ServerResponseException(res, "Invalid feature received during payPal buy", {"feature": data.feature}, "warn", 424);
                return;
            }

            var purchaseProduct = generalUtils.settings.server.payments.purchaseProducts[feature.purchaseProductId];
            var purchaseProductDisplayName = purchaseProduct.displayNames[data.language];
            if (!purchaseProductDisplayName) {
                exceptions.ServerResponseException(res, "Unable to find product display name during payPal buy", {"data": data}, "warn", 424);
                return;
            }

            var urlPrefix;
            if (req.connection.encrypted) {
                urlPrefix = generalUtils.settings.server.general.baseUrlSecured;
            }
            else {
                urlPrefix = generalUtils.settings.server.general.baseUrl;
            }

            paypal.returnUrl = urlPrefix + paypalSettings.successUrl;
            paypal.cancelUrl = urlPrefix + paypalSettings.cancelUrl;

            paypal.pay(invoiceNumber,
                purchaseProduct.cost,
                purchaseProductDisplayName, "USD", function (err, url) {
                    if (err) {

                        dalDb.closeDb(data);
                        exceptions.ServerResponseException(res, err, null, "warn", 424);
                        return;

                    }

                    data.response = {"url": url};

                    dalDb.closeDb(data);

                    callback(null, data);

                });
        }

    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(data.response);
        }
        else {
            res.send(err.httpStatus, err);
        }
    })
};

//-----------------------------------------------------------------------------------------------
// fulfill
//
// data: method (paypal, google, ios, facebook)
//
// For paypal -
//      purchaseData.purchaseToken,
//      purchaseData.payerId
// For facebook - 2 cases:
// - When coming from client:
//      purchaseData.payment_id,
//      purchaseData.amount,
//      purchaseData.currency,
//      purchaseData.quantity,
//      purchaseData.request_id,
//      purchaseData.status,
//      purchaseData.signed_request
//
// - When coming from facebook server callback:
//      entry[0].id is the payment id,
//      entry[0].changed_fields are the fields changed that raised the call
//-----------------------------------------------------------------------------------------------
module.exports.fulfill = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;
    data.token = token;

    fulfillOrder(data, function (err, data) {
        if (!err) {
            if (data.clientResponse) {
                res.json(data.clientResponse);
            }
            else {
                //Coming from server (paypal/facebook) callback
                res.status(200);
            }
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
}

//-----------------------------------------------------------------------------------------------
// fulfillOrder
//
// like fullFill - but can also be called from Paypal IPN or facebook payments callback
// In this case - can be offline - and session is not required
//-----------------------------------------------------------------------------------------------
module.exports.fulfillOrder = fulfillOrder;
function fulfillOrder(data, callback) {

    var now = (new Date()).getTime();
    var operations = [

        function (callback) {
            if (data.method === "facebook") {

                //Retrieve payment info from facebook
                data.sessionOptional = true;

                if (data.purchaseData && data.purchaseData.payment_id) {
                    data.paymentId = data.purchaseData.payment_id; //Coming from client at the end of a successful purchase
                }
                else {
                    data.paymentId = data.entry[0].id; //Coming from facebook server
                }

                if (data.purchaseData && data.purchaseData.signed_request) {
                    var verifier = new dalFacebook.SignedRequest(generalUtils.settings.server.facebook.secretKey, data.purchaseData.signed_request);
                    if (verifier.verify === false) {
                        callback(new exceptions.ServerResponseException(res, "Invalid signed request received from facebook", {"facebookData": data.purchaseData}));
                        return;
                    }
                    data.facebookUserId = verifier.data.user_id;
                }

                dalFacebook.getPaymentInfo(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //getSession
        function (data, callback) {
            sessionUtils.getSession(data, callback);
        },

        //Validate the payment transaction based on method
        function (data, callback) {

            switch (data.method) {
                case "paypal":
                    paypal.detail(data.purchaseData.purchaseToken, data.purchaseData.payerId, function (err, payPalData, invoiceNumber, price) {
                        if (err) {
                            callback(new exceptions.ServerException("Error verifying paypal transacion", {
                                "error": err,
                                "payPalData": payPalData,
                                "invoiceNumber": invoiceNumber,
                                "price": price
                            }, 403));
                            return;
                        }

                        //invoiceNumber is in the format InvoiceNumner_featureName
                        var invoiceNumberParts = invoiceNumber.split("_");
                        data.featurePurchased = invoiceNumberParts[1];
                        data.purchaseData = payPalData;
                        data.proceedPayment = true;
                    });
                    break;

                case "facebook":
                    //Nothing to do here - validtation occured at the payment retrieval above
                    callback(null, data);
                    break;

                default:
                    callback(new exceptions.ServerException("Method not supported for payment validation", {"method": data.method}, 403));
                    return;
            }
        },

        //Store the asset at the user's level
        function (data, callback) {

            if ((data.proceedPayment || (data.dispute && data.itemCharged)) &&
                data.session && (!data.session.assets || !data.session.assets[data.featurePurchased])) {

                if (!data.session.assets) {
                    data.session.assets = {};
                }

                data.session.assets[data.featurePurchased] = {"purchaseDate": now};
                data.session.features = sessionUtils.computeFeatures(data.session);

                if (!data.thirdPartyServerCall) {
                    data.clientResponse = {};
                    data.clientResponse.features = data.session.features;
                    data.clientResponse.featurePurchased = data.featurePurchased;
                    data.clientResponse.nextView = generalUtils.settings.server.features[data.featurePurchased].view;
                }

                dalDb.storeSession(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Store the asset at the user's level
        function (data, callback) {

            if ((data.proceedPayment || (data.dispute && data.itemCharged))) {
                data.setData = {};
                data.setData["assets." + data.featurePurchased] = {"purchaseDate": now};
                if (!data.session) {
                    data.setUserWhereClause = {"facebookUserId": data.facebookUserId};
                }
                else {
                    data.setUserWhereClause = {"_id": ObjectId(data.session.userId)};
                }

                //Update only if asset does not exist yet
                data.setUserWhereClause["assets." + data.featurePurchased] = {$exists: false};

                dalDb.setUser(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Handle facebook dispute or revoke if required
        function (data, callback) {

            if (data.dispute) {
                //At this time - asset must already exist from previous steps
                //Deny the dispute
                dalFacebook.denyDispute(data, callback);
            }
            else if (data.revokeAsset) {
                console.log("TBD...revoke the asset")
                callback(null, data);
            }
            else {
                callback(null, data);
            }
        },
        //Log the purchase and close db
        function (data, callback) {

            data.closeConnection = true;

            data.logAction = {"action": "payment", "extraData": data.purchaseData};
            if (!data.session) {
                data.logAction.facebookUserId = data.facebookUserId;
            }
            else {
                data.logAction.userId = data.session.userId;
            }
            dalDb.logAction(data, callback);
        }
    ];

    async.waterfall(operations, callback);

};
