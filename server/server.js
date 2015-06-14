var express = require('express');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var credentials = require('./business_logic/credentials')
var quiz = require('./business_logic/quiz')
var domain = require('domain');
var GeneralError = require('./business_logic/exceptions').GeneralError;
var app = express();

app.use(bodyParser());          // pull information from html in POST
app.use(methodOverride());      // simulate DELETE and PUT
app.use(express.static('../client/www'));

function domainWrapper() {
    return function (req, res, next) {
        var reqDomain = domain.create();
        reqDomain.add(req);
        reqDomain.add(res);

        res.on('close', function () {
            reqDomain.dispose();
        });
        reqDomain.on('error', function (err) {
            console.log("ooooooooooopsssss....");
            console.error(err.stack);
            var status = 500;
            res.status(status).send(new GeneralError(status));
        });
        reqDomain.run(next)
    }
}
app.use(domainWrapper());

// CORS (Cross-Origin Resource Sharing) headers to support Cross-site HTTP requests
app.all('*', function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        next();
});

//API's require authentication
app.post('/quiz/start', isAuthenticated, quiz.start);
app.post('/users/logout', isAuthenticated, credentials.logout);

//API's that do NOT require authentication
app.post('/users/login', credentials.login);
app.post('/users/register', credentials.register);

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
