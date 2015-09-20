var logger = require("bunyan");

var logConsole = logger.createLogger({
    name: "whoSmarterConsole",
    streams: [{
        stream: process.stderr
        // `type: 'stream'` is implied
    }]
});

var logFile = logger.createLogger({
    name: "whoSmarterLogFile",
    streams: [{
        type: 'rotating-file',
        path: './logs/whoSmarter.log',
        period: '1d',   // daily rotation
        count: 30        // keep 3 back copies
    }],
    serializers: {
        req: reqSerializer
    }
});

//-------------------------------------------------------------------------------------
// Private functions
//-------------------------------------------------------------------------------------
function reqSerializer(req) {
    return {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body
    }
}

//-------------------------------------------------------------------------------------
// Class ServerMessageException
// Exception returned back to the client - which converts the "type"
// to an ionic alert popup (including translation).
// additionalInfo can be passed to the tranlation object to add additional data
//-------------------------------------------------------------------------------------
module.exports.ServerMessageException = ServerMessageException;
function ServerMessageException(type, additionalInfo, httpStatus) {

    var exception = {};

    if (!httpStatus) {
        httpStatus = 403;
    }

    exception.httpStatus = httpStatus;

    if (additionalInfo) {
        exception.additionalInfo = additionalInfo;
    }

    exception.type = type;

    return exception;
}

//-------------------------------------------------------------------------------------
// Class UnhandledServerException
// Exception returned back to the client as a "general" error.
// Usually points to a bug
// to an ionic alert popup (including translation).
// additionalInfo can be passed to the tranlation object to add additional data
//-------------------------------------------------------------------------------------
module.exports.UnhandledServerException = UnhandledServerException;
function UnhandledServerException(err) {

    var exception = new ServerMessageException("SERVER_ERROR_GENERAL", null, 500);
    logFile.fatal(err);
    logConsole.fatal(err);

    //TODO: send an email to the operator

    return exception;
}

//-------------------------------------------------------------------------------------
// Class ServerException
// Exception returned back to the client as a "general" error.
// Usually points to a client hack, wrong data being sent to the server
// Will write to the log the details of the hack
//-------------------------------------------------------------------------------------
module.exports.ServerException = ServerException;
function ServerException(message, additionalInfo, severity, httpStatus) {

    if (!httpStatus) {
        httpStatus = 403;
    }

    var exception = new ServerMessageException("SERVER_ERROR_GENERAL", null, httpStatus);

    if (!additionalInfo) {
        additionalInfo = {};
    }

    if (!severity) {
        severity = "info";
    }

    switch (severity) {
        case "info":
            logFile.info(additionalInfo, message);
            logConsole.info(additionalInfo, message);
            break;
        case "warn":
            logFile.warn(additionalInfo, message);
            logConsole.info(additionalInfo, message);
            break;
        case "error":
            logFile.error(additionalInfo, message);
            logConsole.info(additionalInfo, message);
            break;
    }

    return exception;
}

//-------------------------------------------------------------------------------------
// Class ServerResponseException
// Like ServerException, but sends immediate response to the client
//-------------------------------------------------------------------------------------
module.exports.ServerResponseException = ServerResponseException ;
function ServerResponseException(res, message, additionalInfo, severity, httpStatus) {

    var exception = new ServerException(message, additionalInfo, severity, httpStatus);

    res.send(exception.httpStatus, exception);

    return exception;
}
