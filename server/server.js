//----------------------------------------------------
// Globals
//----------------------------------------------------
var express = require("express");
var bodyParser = require("body-parser");
var methodOverride = require("method-override");
var credentials = require("./business_logic/credentials")
var quiz = require("./business_logic/quiz")
var contests = require("./business_logic/contests");
var exceptions = require("./utils/exceptions")
var generalUtils = require("./utils/general");
var sessionUtils = require("./business_logic/session");
var payments = require("./business_logic/payments");
var dalDb = require("./dal/dalDb");
var http = require("http");
var https = require("https");
var fs = require("fs");
var facebookCanvas = require("./api/facebookCanvas");
var paypalIPN = require("./api/paypalPN");

var domain = require("domain");

var app = express();

app.use(bodyParser());          // pull information from html in POST
app.use(methodOverride());      // simulate DELETE and PUT
app.use(express.static("../client/www"));

//Jade
app.set('views', "./views");
app.set('view engine', 'jade');

//----------------------------------------------------
// Main request processor function
// Wraps requests in a domain to catch errors
//----------------------------------------------------
app.use(function runInsideDomain(req, res, next) {
    var reqDomain = domain.create();

    res.on("close", function () {
        reqDomain.dispose();
    });

    reqDomain.on("error", function (err) {
        reqDomain.dispose();
        next(err);
    });

    reqDomain.run(next);
});

//----------------------------------------------------
// Headers
//----------------------------------------------------
app.all("*", function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

//----------------------------------------------------
// isAuthenticated
//
// Checks if request contains authorization token
//----------------------------------------------------
function isAuthenticated(req, res, next) {
    if (req.headers.authorization) {
        next();
    }
    else {
        res.send(401, "Not Authenticated.")
    }
}

//----------------------------------------------------
// API's that require authentication
//----------------------------------------------------
dalDb.loadSettings(function (err, data) {

    //Block server listener until settings loaded from db
    generalUtils.injectSettings(data.settings);

    app.post("/user/logout", isAuthenticated, credentials.logout);
    app.post("/user/settings", sessionUtils.saveSettings);
    app.post("/user/toggleSound", sessionUtils.toggleSound);
    app.post("/quiz/start", isAuthenticated, quiz.start);
    app.post("/quiz/answer", isAuthenticated, quiz.answer);
    app.post("/quiz/nextQuestion", isAuthenticated, quiz.nextQuestion);
    app.post("/contests/set", isAuthenticated, contests.setContest);
    app.post("/contests/remove", isAuthenticated, contests.removeContest);
    app.post("/contests/get", isAuthenticated, contests.getContests);
    app.post("/payments/paypal/buy", isAuthenticated, payments.payPalBuy);
    app.post("/payments/process", isAuthenticated, payments.processPayment);

    //----------------------------------------------------
    // API's that do NOT require authentication
    //----------------------------------------------------
    app.post("/user/facebookConnect", credentials.facebookConnect);
    app.post("/info/geo", generalUtils.geoInfo);
    app.post("/info/settings", generalUtils.getSettings);
    app.post("/facebook/canvas", facebookCanvas.canvas);
    app.get("/facebook/product/:productId/:language", facebookCanvas.getProductDetails);
    app.post("/facebook/dynamicPricing", facebookCanvas.dynamicPricing);
    app.get("/facebook/ipn", facebookCanvas.getChallenge);
    app.post("/facebook/ipn", facebookCanvas.ipn);
    app.post("/paypal/ipn", paypalIPN.ipn);
    app.get("/download", generalUtils.download);

    //----------------------------------------------------
    // Start server listener
    //----------------------------------------------------
    app.use(function (err, req, res, next) {
        var exception = new exceptions.UnhandledServerException(err);
        res.status(exception.httpStatus).send(exception);
        res.end();
    });

    var certificate = {
        key: fs.readFileSync('./certificates/whosmarter.com.key'),
        ca: [fs.readFileSync('./certificates/gd_bundle-g2-g1.crt')],
        cert: fs.readFileSync('./certificates/whosmarter.crt')
    }

    http.createServer(app).listen(80);
    https.createServer(certificate, app).listen(443);

  /*  var Leaderboard = require("agoragames-leaderboard");
    var highscores = new Leaderboard("hidescores");
    //highscores.rankMember("eddy", 10, "fishman", function(err, reply) {
       //console.log("changeScoreForEddy=" + JSON.stringify(reply));
    //});
    highscores.changeScoreFor("lior", 70, function(err, reply) {
        //console.log("changeScoreForLior=" + JSON.stringify(reply));
    });

    highscores.memberDataFor("eddy", function(reply) {
        console.log("memberDataFor=" + JSON.stringify(reply));
    });*/

    console.log("server up!");

})


