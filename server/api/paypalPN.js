var async = require('async');
var exceptions = require("../utils/exceptions");
var generalUtils = require("../utils/general");
var sessionUtils = require("./../business_logic/session");
var dalDb = require("../dal/dalDb");
var paymentUtils = require("./../business_logic/payments");
var https = require('https');
var qs = require('querystring');

var SANDBOX_URL = 'www.sandbox.paypal.com';
var LIVE_URL = 'www.paypal.com';

//----------------------------------------------------
// ipn
//
// Request coming from paypal servers
//----------------------------------------------------
module.exports.ipn = function (req, res, next) {

    console.log("incoming paypal ipn...");
    var data = req.body;
    data = "cmd=_notify-validate&" + data;
    console.log("data=" + data);
    res.send(200);

    var paypalResponse = "";

    //Set up the request to paypal
    var options = {
        host: SANDBOX_URL,
        port: 443,
        method: "POST",
        path: '/cgi-bin/webscr',
        headers: {'Content-Length': data.length}
    };

    var req = https.request(options, function (res) {

        res.setEncoding("utf8");

        res.on("data", function (chunk) {
            paypalResponse += chunk;
        });

        res.on("end", function () {

            if (paypalResponse == "VERIFIED") {
                console.log("ipn response verified...");
            }
            else {
                console.log("ipn response not verified...result=" + paypalResponse);
            }
        });
    });

    req.on('error', function (error) {
        callback(new exceptions.ServerException("Error recevied from paypal while processing ipn", {
            "data": data,
            "error": error
        }));
    });

    req.write(data);

    req.end();

}
