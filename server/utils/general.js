module.exports.geoInfo = function (req, res, next) {
    var geoInformation = req.body;
    res.json({"language" : getLanguageByCountryCode(geoInformation.country_code)});
}

module.exports.getLanguageByCountryCode = getLanguageByCountryCode;

function getLanguageByCountryCode(countryCode) {
    switch (countryCode) {
        case "IL":
            return "he";

        case "RU":
            return "ru";

        case "AR":  //Argentina
        case "BO":  //Bolivia
        case "CL":  //Chile
        case "CO":  //Colombia
        case "CR":  //Costa Rica
        case "DO":  //Dominican Republic
        case "EC":  //Ecuador
        case "ES":  //Spain
        case "GT":  //Guatemala
        case "HN":  //Honduras
        case "MX":  //Mexico
        case "NI":  //Nicaragua
        case "PA":  //Panama
        case "PE":  //Peru
        case "PR":  //Puerto Rico
        case "PY":  //Paraguay
        case "SV":  //El Salvador
        case "UY":  //Uruguay
        case "VE":  //Venezuela
            return "es";

        default:
            return "en";
    }
}