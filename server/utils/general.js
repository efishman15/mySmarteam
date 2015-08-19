var supportedLanguages = {
    "en": {
        "value" : "en",
        "flag": "images/languages/unitedstates.jpg",
        "direction": "ltr",
        "align": "left",
        "oppositeAlign": "right",
        "displayNames": {"en": "English", "he": "אנגלית", "es": "Inglés"}
    },
    "he": {
        "value" : "he",
        "flag": "images/languages/israel.jpg",
        "direction": "rtl",
        "triviaTopics" : [5,270],
        "align": "right",
        "oppositeAlign": "left",
        "displayNames": {"en": "Hebrew", "he": "עברית", "es": "Hebreo"}
    },
    "es": {
        "value" : "es",
        "flag": "images/languages/spain.jpg",
        "direction": "ltr",
        "triviaSubjectId" : 210,
        "align": "left",
        "oppositeAlign": "right",
        "displayNames": {"en": "Spanish", "he": "ספרדית", "es": "Español"}
    }
}

var triviaTopisPerLangage = {
    "en" : [10],
    "he" : [5,270],
    "es" : [465]
}

module.exports.getDirectionByLanguage = getDirectionByLanguage;
function getDirectionByLanguage(languageCodeIso2) {
    switch (languageCodeIso2) {
        case "he":
            return "rtl";
        default:
            return "ltr";
    }
}

module.exports.getLanguageByCountryCode = getLanguageByCountryCode;
function getLanguageByCountryCode(countryCode) {

    switch (countryCode) {
        case "IL":
            return "he";

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
    res.json({"language": language});
}

module.exports.getLanguages = function (req, res, next) {
    res.json(supportedLanguages);
}

module.exports.getLanguageTriviaTopics = function (language) {
    return triviaTopisPerLangage[language];
}
