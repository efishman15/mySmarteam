var express = require('express'),
    bodyParser     = require('body-parser'),
    methodOverride = require('method-override'),
    credentials = require('./routes/credentials'),
    app = express();

app.use(bodyParser());          // pull information from html in POST
app.use(methodOverride());      // simulate DELETE and PUT

app.use(express.static('../client/www'));

// CORS (Cross-Origin Resource Sharing) headers to support Cross-site HTTP requests
app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

function isAuthenticated(req,res,next){
    if (req.headers.authorization) {
        console.log("Token " + req.headers.authorization + " authenticated...");
        next();
    }
	else {
        res.send(401,"Not Authenticated.")
    }
}

app.post('/users/logout', isAuthenticated, credentials.logout);

app.post('/users/login', credentials.login);
app.post('/users/register', credentials.register);

app.set('port', process.env.PORT || 7000);

app.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});