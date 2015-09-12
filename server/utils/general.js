var mathjs = require("mathjs");

//----------------------------------------------------------------------------------------------------------------------------
// TODO: global variables - should all go to database - with auto load when server starts - SEPARATE CLIENT/SERVER settings
//----------------------------------------------------------------------------------------------------------------------------

//-------------------------------------------------------------------------------
// Supported languages
//-------------------------------------------------------------------------------
var supportedLanguages = {
    "en": {
        "value": "en",
        "direction": "ltr",
        "align": "left",
        "oppositeAlign": "right",
        "displayNames": {"en": "English", "he": "אנגלית", "es": "Inglés"}
    },
    "he": {
        "value": "he",
        "direction": "rtl",
        "triviaTopics": [5, 270],
        "align": "right",
        "oppositeAlign": "left",
        "displayNames": {"en": "Hebrew", "he": "עברית", "es": "Hebreo"}
    },
    "es": {
        "value": "es",
        "direction": "ltr",
        "triviaSubjectId": 210,
        "align": "left",
        "oppositeAlign": "right",
        "displayNames": {"en": "Spanish", "he": "ספרדית", "es": "Español"}
    }
}

//-------------------------------------------------------------------------------
// Trivia topics for each language
//-------------------------------------------------------------------------------
var triviaTopisPerLangage = {
    "en": [10],
    "he": [5, 270],
    "es": [465]
}

var purchaseProducts = {
    "sandbox_feature_newContest" : {
        "displayName": "PURCHASE_NEW_CONTEST_UNLOCK_KEY",
        "cost": "0.99",
        "currency" : "$"
    },
    "sandbox_feature_challengeFriendContest" : {
        "displayName": "PURCHASE_CHALLENGE_FRIEND_CONTEST_UNLOCK_KEY",
        "cost": "0.99",
        "currency" : "$"
    }
}
module.exports.purchaseProducts = purchaseProducts;

//-------------------------------------------------------------------------------
// Features can be unlocked either by having a minimum rank or by purchasing an
// item per that feature
//-------------------------------------------------------------------------------
var features = {
    "rankComputed": false,
    "list": {
        "newContest": {
            "name" : "newContest",
            "lockText": "FEATURE_LOCKED_NEW_CONTEST",
            "purchaseProductId": "sandbox_feature_newContest",
            "unlockText" : "NEW_CONTEST_UNLOCKED",
            "view" : {"name" : "contest", "isRoot" : true, "params" : {"mode" : "add"}}
        },
        "challengeFriendContest": {
            "name" : "challengeFriendContest",
            "lockText": "FEATURE_CHALLENGE_FRIEND_CONTEST",
            "purchaseProductId": "sandbox_feature_challengeFriendContest",
            "unlockText" : "CHALLENGE_FRIEND_CONTEST_UNLOCKED"
        }
    }
}

//-------------------------------------------------------------------------------
// rankByXp steps - rank must be consecutive starting from 1
//-------------------------------------------------------------------------------
var rankByXp = [
    {"xp": 100, "rank": 1},
    {"xp": 500, "rank": 2, "unlockFeature": "newContest", "unlockFeatureMessage": "NEW_CONTEST_UNLOCKED"},
    {"xp": 1500, "rank": 3},
    {"xp": 3000, "rank": 4},
    {"xp": 5000, "rank": 5}
]

module.exports.featuresList = featuresList;
function featuresList() {

    //Lazy compute unlockRank property for each feature
    if (features.rankComputed === false) {
        for (var i = 0; i < rankByXp.length; i++) {
            if (rankByXp[i].unlockFeature) {
                features.list[rankByXp[i].unlockFeature].unlockRank = rankByXp[i].rank;
            }
        }
        features.rankComputed = true;
    }

    return features.list;
}

var xpCredits = {
    "login": 5,
    "joinContest": 2,
    "correctAnswer": 20,
    "quizFullScore": 50,
    "shareContest": 30
}
module.exports.xpCredits = xpCredits;

//-------------------------------------------------------------------------------
// Private functions
//-------------------------------------------------------------------------------

//-------------------------------------------------------------------------------
// binaryRangeSearch - searches a number within a range array
//-------------------------------------------------------------------------------
function binaryRangeSearch(arr, searchProperty, number) {

    if (arr.length == 1) {
        return arr[0][resultProperty];
    }

    var left = 0;
    var right = arr.length - 1;

    var middle;
    while (left < right) {
        middle = mathjs.floor(left + (right - left) / 2);
        if (number <= arr[middle][searchProperty]) {
            right = middle;
        }
        else {
            left = middle + 1;
        }
    }

    return arr[left];
}

//-----------------------------------------------------------------------
// getDirectionByLanguage
//
// returns the direction (ltr/rtl) based on language
//-----------------------------------------------------------------------
module.exports.getDirectionByLanguage = getDirectionByLanguage;
function getDirectionByLanguage(languageCodeIso2) {
    switch (languageCodeIso2) {
        case "he":
            return "rtl";
        default:
            return "ltr";
    }
}

//-----------------------------------------------------------------------
// getLanguageByCountryCode
//
// returns the default language based on country ISO2 code
//-----------------------------------------------------------------------
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

//-----------------------------------------------------------------------
// geoInfo
//
// returns language based on country
//-----------------------------------------------------------------------
module.exports.geoInfo = function (req, res, next) {
    var geoInformation = req.body;
    var language = getLanguageByCountryCode(geoInformation.country_code);
    res.json({"language": language});
}

//-----------------------------------------------------------------------
// getSettings (client request)
//
// returns general server settings for each client
//-----------------------------------------------------------------------
module.exports.getSettings = function (req, res, next) {
    res.json(generalSettings);
}

//-----------------------------------------------------------------------
// getLanguageTriviaTopics
//
// returns trivia topic list for each language
//-----------------------------------------------------------------------
module.exports.getLanguageTriviaTopics = function (language) {
    return triviaTopisPerLangage[language];
};

//---------------------------------------------------------------------------------------------------
// XpProgress class
//
// Constructs the xp in a relational manner to be presented in a progress element
// addXP function:
// object can be either a session or a user - both should contain xp and rank as properties
//---------------------------------------------------------------------------------------------------
module.exports.XpProgress = XpProgress;
function XpProgress(xp, rank) {
    this.addition = 0;
    this.xp = xp;
    this.rank = rank;
    this.refresh();
}

XpProgress.prototype.addXp = function (object, action) {
    var xp = xpCredits[action];
    if (xp) {

        object.xp += xp;
        var result = binaryRangeSearch(rankByXp, "xp", object.xp);

        //update object (session, user)
        object.rank = result.rank;


        //update my progress
        this.addition += xp;
        this.xp += xp;

        if (result.rank > this.rank) {
            this.rankChanged = true;
            if (result.unlockFeature && result.unlockFeatureMessage) {
                this.unlockFeatureMessage = result.unlockFeatureMessage;
            }
            this.rank = result.rank
        }
        else {
            this.rankChanged = false;
        }

        this.refresh();

    }
};

XpProgress.prototype.refresh = function () {
    var xpForRank;
    if (this.rank - 2 >= 0) {
        xpForRank = rankByXp[this.rank - 2].xp;
    }
    else {
        xpForRank = 0;
    }

    var xpForNextRank = rankByXp[this.rank - 1].xp;
    var xpAchievedInRank = this.xp - xpForRank;
    var xpDiff = xpForNextRank - xpForRank;

    this.current = xpAchievedInRank;
    this.max = xpDiff;
};

//-------------------------------------------------------------------------------
// generalSettings - sent back to the client
//-------------------------------------------------------------------------------
var generalSettings = {
    "languages": supportedLanguages,
    "features": featuresList(),
    "charts": {
        "size": {"width": 260, "height": 180},
        "contestAnnotations": {
            "annotationsFont": "10px Arial",
            "annotationHorizontalMagicNumbers": {
                "ltr": {
                    "endsIn": {"id": 0, "position": "$chartstartx + ", "spacing": 2},
                    "participants": {"id": 1, "position": "$chartendx - ", "spacing": 0}
                },
                "rtl": {
                    "endsIn": {"id": 0, "position": "$chartendx - ", "spacing": 7},
                    "participants": {"id": 1, "position": "$chartstartx + ", "spacing": 3}
                },
            }
        },
        "chartObject": {
            "chart": {
                "bgColor": "#FFFFFF",
                "plotBorderAlpha": 0,
                "baseFont": "Arial",
                "baseFontSize": 12,
                "showBorder": 1,
                "showCanvasBorder": 0,
                "showPlotBorder": 0,
                "showCanvasBg": 0,
                "yAxisMinValue": 0.0,
                "yAxisMaxValue": 1.0,
                "numDivLines": 0,
                "adjustDiv": 0,
                "divLineColor": "#FFFFFF",
                "labelFontColor": "#040404",
                "numberScaleValue": ".01",
                "numberScaleUnit": "%",
                "showYAxisValues": 0,
                "valueFontSize": 12,
                "labelFontSize": "14",
                "chartBottomMargin": 25,
                "valuePadding": 0,
                "labelPadding": 10,
                "useRoundEdges": "1",
                "showToolTip": 0,
                "labelDisplay": "auto",
                "useEllipsesWhenOverflow": 1,
                "maxLabelWidthPercent": 50
            },
            "annotations": {
                "groups": [
                    {
                        "id": "infobar",
                        "items": [
                            {
                                "id": "label",
                                "type": "text",
                                "y": "$chartendy - 8",
                                "fontSize": 10,
                                "font": "Arial",
                                "fontColor": "#000000"
                            },
                            {
                                "id": "label",
                                "type": "text",
                                "y": "$chartendy - 8",
                                "fontSize": 10,
                                "font": "Arial",
                                "fontColor": "#000000"
                            }
                        ]
                    }
                ]
            },
        }
    },
    "contestList": {
        "pageSize": 5,
        "distance": "50%"
    },
    "quiz": {"longAnswerTreshold": 30},
    "xpControl": {
        "canvas": {"width": 40, "height": 44},
        "radius": 15,
        "fillColor": "#ffff37",
        "lineWidth": 4,
        "fullLineColor": "#cccccc",
        "progressLineColor": "#0094ff",
        "font": {"bold": true, "name": "Arial", "d1": "14px", "d2": "14px", "d3": "11px"},
        "textColor": "#444",
        "shadow": {"offsetX": 0, "offsetY": 0, blur: 10, color: "#656565'"}
    },
    "db": {"sessionExpirationMilliseconds": 30 * 60 * 1000}, //TODO: split between client settings and server settings
    "purchaseProducts" : purchaseProducts
}
module.exports.generalSettings = generalSettings;
