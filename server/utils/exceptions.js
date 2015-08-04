///Class FormValidationError
function FormValidationError(status, fieldName, message) {
    var error = GeneralError(status, message);
    error.fieldName = fieldName;
    return error;
}

///Class ServerError
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

module.exports.FormValidationError = FormValidationError;
module.exports.GeneralError = GeneralError;