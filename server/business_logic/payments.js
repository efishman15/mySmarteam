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

PaypalObject.prototype.getExpressCheckoutDetails = function (token, payer, callback) {
    var params = this.params();
    params.TOKEN = token;
    params.METHOD = 'GetExpressCheckoutDetails';

    this.request(this.url, "POST", params, function (err, data) {
        if (err) {
            callback(err, data);
        }
        callback(null, data);
    })
};

PaypalObject.prototype.doExpressCheckoutPayment = function (token, payer, amount, currency, callback) {
    var params = this.params();
    params.PAYMENTACTION = 'Sale';
    params.PAYERID = payer;
    params.TOKEN = token;
    params.AMT = amount;
    params.CURRENCYCODE = currency;
    params.METHOD = 'DoExpressCheckoutPayment';

    this.request(this.url, "POST", params, function (err, data) {
        if (err) {
            callback(err, data);
        }
        callback(null, data);
    })
};


function prepareClientResponse(data) {
    data.clientResponse = {};
    data.clientResponse.features = data.session.features;
    data.clientResponse.featurePurchased = data.featurePurchased;
    data.clientResponse.nextView = generalUtils.settings.server.features[data.featurePurchased].view;
}

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
// processPayment
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
module.exports.processPayment = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;
    data.token = token;

    data.paymentId = data.purchaseData.payment_id;

    innerProcessPayment(data, function (err, data) {
        if (!err) {
            res.json(data.clientResponse);
        }
        else if (!data) {
            res.send(err.httpStatus, err);
        }
        else {
            if (data.newPurchase.status.toLowerCase() === "completed") {
                //This is an intentional stop - data contains client response
                //A duplicate purchase which has completed successfully by another thread
                res.json(data.clientResponse)

            }
            else {
                res.send(err.httpStatus, err);
            }
        }
    });
}

//-----------------------------------------------------------------------------------------------
// innerProcessPayment
//
// like processPayment - but can also be called from Paypal IPN or facebook payments callback
// In this case - can be offline - and session is not required
//-----------------------------------------------------------------------------------------------
module.exports.innerProcessPayment = innerProcessPayment;
function innerProcessPayment(data, callback) {

    var now = (new Date()).getTime();
    var operations = [

        function (callback) {

            data.newPurchase = {"method": data.method};

            switch (data.method) {
                case "paypal":
                    if (!data.thirdPartyServerCall) {
                        //comming from client
                        paypal.getExpressCheckoutDetails(data.purchaseData.purchaseToken, data.purchaseData.payerId, function (err, paypalData) {
                            if (err) {
                                callback(new exceptions.ServerException("Error getting paypal express checkout details", {
                                    "error": err,
                                    "purchaseData": data
                                }, 403));
                            }

                            data.paymentData = paypalData;

                            console.log("paypalData=" + JSON.stringify(paypalData));

                            data.newPurchase.transactionId = paypalData.PAYMENTREQUEST_0_TRANSACTIONID;
                            var serverErrorType;
                            switch (paypalData.CHECKOUTSTATUS) {
                                case "PaymentActionNotInitiated":
                                    data.newPurchase.status = "NotInitiated";
                                    serverErrorType = "SERVER_ERROR_PURCHASE_FAILED";
                                    break;
                                case "PaymentActionFailed":
                                    data.newPurchase.status = "Failed";
                                    serverErrorType = "SERVER_ERROR_PURCHASE_FAILED";
                                    break;
                                case "PaymentActionInProgress":
                                    data.newPurchase.status = "InProgress";
                                    serverErrorType = "SERVER_ERROR_PURCHASE_IN_PROGRESS";
                                    break;
                                case "PaymentActionCompleted":
                                    data.newPurchase.status = "Completed";
                                    break;
                            }

                            //invoiceNumber is in the format InvoiceNumner_featureName
                            data.featurePurchased = data.paymentData.INVNUM.split("_")[1];

                            if (data.newPurchase.status === "Completed") {
                                dalDb.insertPurchase(data, callback);
                            }
                            else {
                                callback(new exceptions.ServerMessageException(serverErrorType, null, 424));
                            }
                        })
                    }
                    else {
                        //Server call
                        data.newPurchase.transactionId = data.paymentData.txn_id;
                        data.newPurchase.status = data.paymentData.payment_status;
                        data.featurePurchased = data.paymentData.invoice.split("_")[1];
                        dalDb.insertPurchase(data, callback);
                    }
                    break;

                case "facebook":
                    dalFacebook.getPaymentInfo(data, function () {
                        data.newPurchase.transactionId = data.paymentData.id;
                        data.newPurchase.status = data.paymentData.status;
                        dalDb.insertPurchase(data, callback);
                    });
                    break;
            }
        },

        //getSession
        function (data, callback) {
            sessionUtils.getSession(data, callback);
        },

        //check for duplicate purchase (client and server occur at the same time or hacking)
        function (data, callback) {
            if (data.duplicatePurchase) {
                if (!data.thirdPartyServerCall) {
                    prepareClientResponse(data);
                }
                callback(new exceptions.ServerException("Duplicate purchase", data, "info", 424), data);
            }
            else {
                callback(null, data);
            }
        },

        //Validate the payment transaction based on method
        function (data, callback) {

            switch (data.method) {
                case "paypal":
                    if (!data.thirdPartyServerCall) {
                        paypal.doExpressCheckoutPayment(data.purchaseData.purchaseToken, data.purchaseData.payerId, data.paymentData.PAYMENTREQUEST_0_AMT, data.paymentData.PAYMENTREQUEST_n_CURRENCYCODE, function (err, resultData, invoiceNumber, price) {
                            if (err) {
                                callback(new exceptions.ServerException("Error verifying paypal transacion", {
                                    "error": err,
                                    "purchaseData": data.purchaseData,
                                    "paymentData": data.paymentData
                                }, 403));
                                return;
                            }

                            data.proceedPayment = true;
                            callback(null, data);
                        });
                    }
                    break;

                case "facebook":
                    //Double check - if client tries to hack without a signed request
                    //Make sure the purchase belongs to him
                    if (data.session && data.purchaseData && !data.purchaseData.signed_request && data.paymentData.user && data.paymentData.user.id !== data.session.facebookUserId) {
                        callback(new exceptions.ServerException("Error validating payment, payment belongs to someone else", {
                            "purchaseData": data.purchaseData,
                            "paymentData": data.paymentData,
                            "actualFacebookId": data.session.facebookUserId
                        }));
                        return;
                    }

                    callback(null, data);
                    break;

                default:
                    callback(new exceptions.ServerException("Method not supported for payment validation", {"method": data.method}, 403));
                    return;
            }
        },

        //Store the asset at the user's level
        function (data, callback) {

            if ((data.proceedPayment || data.revokeAsset || (data.dispute && data.itemCharged)) &&
                data.session) {

                if (data.revokeAsset) {
                    //Revoke the asset if it has been bought within the same purchase method
                    if (data.session.assets && data.session.assets[data.featurePurchased] && data.session.assets[data.featurePurchased].method === data.method) {
                        delete data.session.assets[data.featurePurchased];
                    }
                }
                else {
                    //Give the asset
                    if (!data.session.assets) {
                        data.session.assets = {};
                    }

                    data.session.assets[data.featurePurchased] = {"purchaseDate": now, "method": data.method};
                    data.session.features = sessionUtils.computeFeatures(data.session);
                }

                if (!data.thirdPartyServerCall) {
                    prepareClientResponse(data);
                }

                dalDb.storeSession(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Store the asset at the user's level
        function (data, callback) {

            if ((data.proceedPayment || data.revokeAsset || (data.dispute && data.itemCharged))) {
                if (!data.session) {
                    data.setUserWhereClause = {"facebookUserId": data.facebookUserId};
                }
                else {
                    data.setUserWhereClause = {"_id": ObjectId(data.session.userId)};
                }

                if (data.revokeAsset) {
                    data.unsetData = {};
                    data.unsetData["assets." + data.featurePurchased] = "";
                }
                else {
                    data.setData = {};
                    data.setData["assets." + data.featurePurchased] = {"purchaseDate": now, "method": data.method};

                    //Update only if asset does not exist yet
                    data.setUserWhereClause["assets." + data.featurePurchased] = {$exists: false};
                }

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
                //Deny the dispute - currently dispute supported on facebook only
                dalFacebook.denyDispute(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Log the purchase and close db
        function (data, callback) {

            data.closeConnection = true;

            data.logAction = {"action": "payment", "extraData": data.paymentData};
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
