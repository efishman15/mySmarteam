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
var domain = require("domain");

var app = express();

app.use(bodyParser());          // pull information from html in POST
app.use(methodOverride());      // simulate DELETE and PUT
app.use(express.static("../client/www"));

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
app.post("/user/logout", isAuthenticated, credentials.logout);
app.post("/user/settings", sessionUtils.saveSettings);
app.post("/user/toggleSound", sessionUtils.toggleSound);
app.post("/quiz/start", isAuthenticated, quiz.start);
app.post("/quiz/answer", isAuthenticated, quiz.answer);
app.post("/quiz/nextQuestion", isAuthenticated, quiz.nextQuestion);
app.post("/contests/set", isAuthenticated, contests.setContest);
app.post("/contests/remove", isAuthenticated, contests.removeContest);
app.post("/contests/get", isAuthenticated, contests.getContests);

//----------------------------------------------------
// API's that do NOT require authentication
//----------------------------------------------------
app.post("/user/facebookConnect", credentials.facebookConnect);
app.post("/info/geo", generalUtils.geoInfo);
app.post("/info/settings", generalUtils.getSettings);

//----------------------------------------------------
// Start server listener
//----------------------------------------------------
app.use(function (err, req, res, next) {
    var exception = new exceptions.UnhandledServerException(err);
    res.status(exception.httpStatus).send(exception);
    res.end();
});

app.set("port", process.env.PORT || 7000);

app.listen(app.get("port"), function () {
    console.log("Express server listening on port " + app.get("port"));
});
