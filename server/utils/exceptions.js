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
        error.message = 'Oops, something went wrong. Please try again';
    }

    return error;
}

module.exports.FormValidationError = FormValidationError;
module.exports.GeneralError = GeneralError;