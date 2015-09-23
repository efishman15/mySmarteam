var async = require("async");
var dalDb = require("../dal/dalDb");
var exceptions = require("../utils/exceptions");
var generalUtils = require("../utils/general");

//----------------------------------------------------
// private functions
//----------------------------------------------------

//----------------------------------------------------
// adjustMobileClosestCost
//----------------------------------------------------
function adjustMobileClosestCost(session, feature) {
    for (var i = 0; i < session.thirdParty.paymentMobilePricepoints.pricepoints.length; i++) {

        //Out default cost is in USD
        //Find closest price (from top) - or stop at the last pricepoint
        if (i === session.thirdParty.paymentMobilePricepoints.pricepoints.length - 1 ||
            session.thirdParty.paymentMobilePricepoints.pricepoints[i].payer_amount >= feature.purchaseData.cost * session.thirdParty.currency.usd_exchange_inverse) {

            feature.purchaseData.cost = session.thirdParty.paymentMobilePricepoints.pricepoints[i].payer_amount;
            feature.purchaseData.currency = session.thirdParty.paymentMobilePricepoints.user_currency;

            feature.purchaseData.mobilePricepointId = session.thirdParty.paymentMobilePricepoints.pricepoints[i].pricepoint_id;

            var currencySymbol = generalUtils.settings.server.payments.currencies[feature.purchaseData.currency];
            if (!currencySymbol) {
                currencySymbol = feature.purchaseData.currency;
            }
            feature.purchaseData.currencySymbol = currencySymbol;
            break;
        }
    }
}

//----------------------------------------------------
// getSession

// data
//
// data:
// input: token
// output: session
//----------------------------------------------------
module.exports.getSession = function (data, callback) {

    var operations = [

        //Connect to the database (so connection will stay open until we decide to close it)
        dalDb.connect,

        function (connectData, callback) {
            data.DbHelper = connectData.DbHelper;
            dalDb.retrieveSession(data, callback);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            callback(null, data);
        }
        else {
            callback(err);
        }
    });
};

//----------------------------------------------------
// saveSettings
//
// data: settings
//----------------------------------------------------
module.exports.saveSettings = function (req, res, next) {

    var data = req.body;
    var token = req.headers.authorization;

    var operations = [

        //Connect to the database
        dalDb.connect,

        //Retrieve the session
        function (connectData, callback) {
            data.DbHelper = connectData.DbHelper;
            data.token = token;
            dalDb.retrieveSession(data, callback);
        },

        //Store the session back
        function (data, callback) {
            data.session.settings = data.settings;
            dalDb.storeSession(data, callback);
        },

        //Save the settings to the user object
        function (data, callback) {
            data.setData = {"settings": data.session.settings};
            data.closeConnection = true;
            dalDb.setUser(data, callback);
        }
    ];

    async.waterfall(operations, function (err) {
        if (!err) {
            res.send(200, "OK");
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};

//----------------------------------------------------
// Toggle Sound
//----------------------------------------------------
module.exports.toggleSound = function (req, res, next) {

    var token = req.headers.authorization;

    var operations = [

        //Connect to the database
        dalDb.connect,

        //Retrieve the session
        function (data, callback) {
            data.token = token;
            dalDb.retrieveSession(data, callback);
        },

        //Store the session back
        function (data, callback) {
            data.session.settings.sound = !data.session.settings.sound
            dalDb.storeSession(data, callback);
        },

        //Save the settings to the user object
        function (data, callback) {
            data.setData = {"settings.sound": data.session.settings.sound};
            data.closeConnection = true;
            dalDb.setUser(data, callback);
        }

    ];

    async.waterfall(operations, function (err) {
        if (!err) {
            res.send(200, "OK");
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};

//---------------------------------------------------------------------------------
// computeFeatures
//
// Can receive either user object or session object.

// Runs through the available features in settings
// and computes lock state, cost, currency and unlockRank, lockText, unlockText
//
// returns: the computed feature list
//---------------------------------------------------------------------------------
module.exports.computeFeatures = function (userOrSession) {

    var features = {};
    for (var property in generalUtils.settings.server.features) {
        if (generalUtils.settings.server.features.hasOwnProperty(property)) {
            features[property] = {};
            var serverFeature = generalUtils.settings.server.features[property];
            features[property].name = serverFeature.name;
            features[property].lockText = serverFeature.lockText;
            features[property].unlockText = serverFeature.unlockText;
            features[property].unlockRank = serverFeature.unlockRank;
            features[property].purchaseData = JSON.parse(JSON.stringify(generalUtils.settings.server.payments.purchaseProducts[serverFeature.purchaseProductId]));

            var currencySymbol = generalUtils.settings.server.payments.currencies[features[property].purchaseData.currency];
            if (!currencySymbol) {
                currencySymbol = features[property].purchaseData.currency;
            }

            features[property].purchaseData.currencySymbol = currencySymbol;

            if (!features[property].purchaseData.mobilePricepointId && userOrSession.thirdParty && userOrSession.thirdParty.paymentMobilePricepoints && !features[property].mobilePricepointId) {
                adjustMobileClosestCost(userOrSession,features[property]);
            }

            switch (property) {
                case "newContest":
                    features[property].locked = !(userOrSession.isAdmin) &&
                        userOrSession.rank < serverFeature.unlockRank &&
                        (!userOrSession.assets || !userOrSession.assets[property])
                    break;
                case "challengeFriendContest":
                    features[property].locked = true;
            }
        }
    }

    return features;
}
