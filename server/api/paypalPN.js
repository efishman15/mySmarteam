var async = require('async');
var exceptions = require("../utils/exceptions");
var dalDb = require("../dal/dalDb");
var logger = require("../utils/logger");
var paymentUtils = require("./../business_logic/payments");
var https = require('https');
var querystring = require('querystring');

var SANDBOX_URL = 'www.sandbox.paypal.com';
var LIVE_URL = 'www.paypal.com';

//----------------------------------------------------
// ipn
//
// Request coming from paypal servers
//----------------------------------------------------
module.exports.ipn = function (req, res, next) {

    var payPalData = req.body;
    var data = {};

    logger.paypalIPN.info(data, "incoming paypal ipn");

    res.send(200); //Instantly respond

    data.cmd = "_notify-validate";
    var postData = querystring.stringify(payPalData);

    var paypalResponse = "";

    //Set up the request to paypal
    var options = {
        host: SANDBOX_URL,
        port: 443,
        method: "POST",
        path: '/cgi-bin/webscr',
        headers: {'Content-Length': postData.length}
    };

    var req = https.request(options, function (res) {

        res.setEncoding("utf8");

        res.on("data", function (chunk) {
            paypalResponse += chunk;
        });

        res.on("end", function () {

            if (paypalResponse === "VERIFIED") {
                logger.paypalIPN.info(null, "ipn verified");

                data.method = "paypal";
                data.thirdPartyServerCall = true;
                data.sessionOptional = true;
                data.paymentData = payPalData;

                paymentUtils.innerProcessPayment(data, function (err, response) {
                    if (err) {
                        logger.paypalIPN.error(err, "error during processing paypal ipn");
                    }
                });
            }
            else {
                logger.paypalIPN.error(null, "ipn response not verified, result=" + paypalResponse);
            }
        });
    });

    req.on('error', function (error) {
        callback(new exceptions.ServerException("Error recevied from paypal while processing ipn", {
            "data": data,
            "error": error
        }));
    });

    req.write(postData);

    req.end();
}
