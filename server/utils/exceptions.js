//-----------------------------------------------------------------------
// Class GeneralError
//
// can hold: status, message and title
//-----------------------------------------------------------------------
function GeneralError(status, message) {
    var error = {};
    error.status = status;
    if (message) {
        error.message = message;
    }
    else {
        error.title = "GENERAL_APPLICATION_ERROR_TITLE";
        error.message = "GENERAL_APPLICATION_ERROR_MESSAGE";
    }

    return error;
}

module.exports.GeneralError = GeneralError;