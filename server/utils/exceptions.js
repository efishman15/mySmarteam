var path = require("path");
var logger = require(path.resolve(__dirname,"./logger"));

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
    logger.server.fatal(err);
    logger.console.fatal(err);

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
            logger.server.info(additionalInfo, message);
            logger.console.info(additionalInfo, message);
            break;
        case "warn":
            logger.server.warn(additionalInfo, message);
            logger.console.info(additionalInfo, message);
            break;
        case "error":
            logger.server.error(additionalInfo, message);
            logger.console.info(additionalInfo, message);
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

//-------------------------------------------------------------------------------------
// Class InternalServerException
// Exception returned back between 2 server calls
// Do not write to the log - just construct the exception object
//-------------------------------------------------------------------------------------
module.exports.InternalServerException = InternalServerException;
function InternalServerException(message, additionalInfo) {

    var exception = {"message" : message};

    if (additionalInfo) {
        exception.additionalInfo = additionalInfo;
    }

    return exception;
}
