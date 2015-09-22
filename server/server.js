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
var facebookCanvas = require("./business_logic/facebookCanvas")

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
    app.post("/payments/fulfill", isAuthenticated, payments.fulfill);

    //----------------------------------------------------
    // API's that do NOT require authentication
    //----------------------------------------------------
    app.post("/user/facebookConnect", credentials.facebookConnect);
    app.post("/info/geo", generalUtils.geoInfo);
    app.post("/info/settings", generalUtils.getSettings);
    app.post("/fb/canvas", facebookCanvas.canvas);
    app.get("/fb/payments/:productId/:language",facebookCanvas.getProductDetails);
    app.post("/fb/payments/dynamicPricing",facebookCanvas.dynamicPricing);
    app.get("/fb/payments/flow",facebookCanvas.getChallenge);
    app.post("/fb/payments/flow",facebookCanvas.paymentFlow);

    //----------------------------------------------------
    // Start server listener
    //----------------------------------------------------
    app.use(function (err, req, res, next) {
        var exception = new exceptions.UnhandledServerException(err);
        res.status(exception.httpStatus).send(exception);
        res.end();
    });

    var certificate = {
        key: fs.readFileSync('./whosmarter.com.key'),
        ca: [fs.readFileSync('./gd_bundle-g2-g1.crt')],
        cert: fs.readFileSync('./whosmarter.crt')
    }

    http.createServer(app).listen(7000);
    https.createServer(certificate, app).listen(8000);

    console.log("server up!");

})


