 function getDirectionByLanguage(languageCodeIso2) {
     switch (languageCodeIso2) {
         case "he":
             return "rtl";
         default:
             return "ltr";
     }
 }

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

module.exports.geoInfo = function (req, res, next) {
    var geoInformation = req.body;
    var language = getLanguageByCountryCode(geoInformation.country_code);
    var direction = getDirectionByLanguage(language);
    res.json({"language" : language, "direction" : direction});
}

 module.exports.getDirectionByLanguage = getDirectionByLanguage;
 module.exports.getLanguageByCountryCode = getLanguageByCountryCode;