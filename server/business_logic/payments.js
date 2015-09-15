var sessionUtils = require("../business_logic/session");
var uuid = require("node-uuid");
var async = require('async');
var exceptions = require('../utils/exceptions');
var dalDb = require('../dal/dalDb');
var generalUtils = require("../utils/general")
var debug = true;
var PaypalObject = require('paypal-express-checkout').Paypal;
var paypal = require('paypal-express-checkout').init('testseller2_api1.whosmarter.com', '9VXL24PFJ9LX8GSS', 'AvYW0oSj.WW9Wh3OfTtEun4M6OFuApinXztzGPxJWkswTqZuwteL7KEV', 'https://www.whosmarter.com:8000/#/payment?purchaseMethod=paypal&purchaseSuccess=1', 'http://studyb4.ddns.net:7000/#/cancelPaypal', debug);

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

    var token = req.headers.authorization;
    var data = req.body;

    if (!data.language) {
        exceptions.ServerResponseException(res, "Language not received during payPal buy", null, "warn", 424);
        return;
    }

    //Invoice number will contain the product id which will be required later for validation
    var invoiceNumber = uuid.v1() + "_" + data.feature;

    var feature = generalUtils.settings.server.features[data.feature];
    if (!feature) {
        exceptions.ServerResponseException(res, "Invalid feature received during payPal buy", {"feature": data.feature}, "warn", 424);
        return;
    }

    var purchaseProduct = generalUtils.settings.server.purchaseProducts[feature.purchaseProductId];
    var purchaseProductDisplayName = purchaseProduct.displayNames[data.language];
    if (!purchaseProductDisplayName) {
        exceptions.ServerResponseException(res, "Unable to find product display name during payPal buy", {"data": data}, "warn", 424);
        return;
    }

    paypal.pay(invoiceNumber,
        purchaseProduct.cost,
        purchaseProductDisplayName, "USD", function (err, url) {
            if (err) {

                exceptions.ServerResponseException(res, err, null, "warn", 424);
                return;

            }

            res.json({"url": url});
        });
};

//--------------------------------------------------------------------------
// validate
//
// data: method (paypal, google, ios, facebook), purchaseToken, payerId
//--------------------------------------------------------------------------
module.exports.validate = function (req, res, next) {

    var token = req.headers.authorization;
    var data = req.body;
    var operations = [

        //getSession
        function (callback) {
            data.token = token;
            sessionUtils.getSession(data, callback);
        },

        //Validate the payment transaction based on method
        function (data, callback) {

            switch (data.method) {
                case "paypal":
                    paypal.detail(data.purchaseToken, data.payerId, function (err, payPalData, invoiceNumber, price) {
                        if (err) {
                            callback(new exceptions.ServerException("Error verifying paypal transacion", {
                                "error": err,
                                "payPalData": payPalData,
                                "invoiceNumber": invoiceNumber,
                                "price": price
                            }, 403));
                            return;
                        }
                        if (!data.session.assets) {
                            data.session.assets = {};
                        }

                        //invoiceNumber is in the format InvoiceNumner_featureName
                        var invoiceNumberParts = invoiceNumber.split("_");
                        data.purchaseData = payPalData;

                        data.response = {};

                        var featurePurchased = invoiceNumberParts[1];
                        data.session.assets[featurePurchased] = true;
                        data.session.features = sessionUtils.computeFeatures(data.session);

                        data.response.features = data.session.features;
                        data.response.featurePurchased = featurePurchased;
                        data.response.nextView = generalUtils.settings.server.features[featurePurchased].view;

                        dalDb.storeSession(data, callback);
                    });
                    break;

                default:
                    callback(new exceptions.ServerException("Method not supported for payment validation", {"method": data.method}, 403));
                    return;
            }
        },

        //Store the asset at the user's level
        function (data, callback) {
            data.setData = {};
            data.setData["assets." + data.response.unlockFeature] = true;
            dalDb.setUser(data, callback);
        },

        //Log the purchase and close db
        function (data, callback) {
            data.action = "payment";
            data.actionData = data.purchaseData;
            data.closeConnection = true;
            dalDb.logAction(data, callback);
        }
    ]

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(data.response);
        }
        else {
            res.send(err.httpStatus, err);
        }
    })
};
