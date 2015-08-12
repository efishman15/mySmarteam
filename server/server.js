var express = require('express');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var credentials = require('./business_logic/credentials')
var quiz = require('./business_logic/quiz')
var GeneralError = require('./utils/exceptions').GeneralError;
var generalUtils = require('./utils/general');
var sessionUtils = require('./business_logic/session');
var domain = require('domain');

var app = express();

app.use(bodyParser());          // pull information from html in POST
app.use(methodOverride());      // simulate DELETE and PUT
app.use(express.static('../client/www'));

app.use(function runInsideDomain(req, res, next) {
    var reqDomain = domain.create();

    res.on('close', function () {
        reqDomain.dispose();
    });

    reqDomain.on('error', function (err) {
        reqDomain.dispose();
        next(err);
    });

    reqDomain.run(next);
});

// CORS (Cross-Origin Resource Sharing) headers to support Cross-site HTTP requests
app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

//API's require authentication
app.post('/quiz/subjects', isAuthenticated, quiz.subjects);
app.post('/quiz/start', isAuthenticated, quiz.start);
app.post('/quiz/answer', isAuthenticated, quiz.answer);
app.post('/quiz/nextQuestion', isAuthenticated, quiz.nextQuestion);
app.post('/users/logout', isAuthenticated, credentials.logout);
app.post('/users/confirmPassword', sessionUtils.confirmPassword);
app.post('/users/settings', sessionUtils.saveSettings);
app.post('/users/setProfile', sessionUtils.setProfile);
app.post('/users/toggleSound', sessionUtils.toggleSound);
app.post('/users/removeProfile', sessionUtils.removeProfile);

//API's that do NOT require authentication
app.post('/users/login', credentials.login);
app.post('/users/register', credentials.register);
app.post('/info/geo', generalUtils.geoInfo);
app.post('/info/languages', generalUtils.getLanguages);

app.use(function (err, req, res, next) {
    console.log('error on request %s %s: %s', req.method, req.url, err.stack);
    var status = 500;
    res.status(status).send(new GeneralError(status));
    res.end();
});

app.set('port', process.env.PORT || 7000);

app.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});

function isAuthenticated(req, res, next) {
    if (req.headers.authorization) {
        next();
    }
    else {
        res.send(401, "Not Authenticated.")
    }
}
