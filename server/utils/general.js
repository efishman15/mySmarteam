var supportedLanguages = [
    {"value": "en", "flag": "/images/languages/unitedstates.jpg", "direction" : "ltr", "displayNames" : {"en" : "English", "he" : "אנגלית", "es" : "Inglés", "ru" : "Английский"}},
    {"value": "he", "flag": "/images/languages/israel.jpg", "direction" : "rtl", "displayNames" : {"en" : "Hebrew", "he" : "עברית", "es" : "Hebreo", "ru" : "Иврит"}},
    {"value": "ru", "flag": "/images/languages/russia.jpg", "direction" : "ltr", "displayNames" : {"en" : "Russian", "he" : "רוסית", "es" : "Ruso", "ru" : "Русский"}},
    {"value": "es", "flag": "/images/languages/spain.jpg", "direction" : "ltr", "displayNames" : {"en" : "Spanish", "he" : "ספרדית", "es" : "Español", "ru" : "Испанский"}}
]

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

module.exports.getLanguages = function (req, res, next) {
    res.json(supportedLanguages);
}
 module.exports.getDirectionByLanguage = getDirectionByLanguage;
 module.exports.getLanguageByCountryCode = getLanguageByCountryCode;
