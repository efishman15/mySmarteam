var mathjs = require("mathjs");

var settings;
module.exports.injectSettings = function(dbSettings) {
    settings = dbSettings;

    //Compute unlockRank for each feature using the rankByXp settings
    for (var i = 0; i < settings.server.rankByXp.length; i++) {
        if (settings.server.rankByXp[i].unlockFeature) {
            settings.server.features[settings.server.rankByXp[i].unlockFeature].unlockRank = settings.server.rankByXp[i].rank;
        }
    }

    module.exports.settings = settings;

}

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

    var direction = settings.server.directionByLanguage[languageCodeIso2];

    if (direction) {
        return direction;
    }
    else {
        return settings.server.directionByLanguage["default"];
    }
}

//-----------------------------------------------------------------------
// getLanguageByCountryCode
//
// returns the default language based on country ISO2 code
//-----------------------------------------------------------------------
module.exports.getLanguageByCountryCode = getLanguageByCountryCode;
function getLanguageByCountryCode(countryCode) {

    var language = settings.server.languageByCountryCode[countryCode];

    if (language) {
        return language;
    }
    else {
        return settings.server.languageByCountryCode["default"];
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
    res.json(settings.client);
}

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
    var xp = settings.server.xpCredits[action];
    if (xp) {

        object.xp += xp;
        var result = binaryRangeSearch(settings.server.rankByXp, "xp", object.xp);

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
        xpForRank = settings.server.rankByXp[this.rank - 2].xp;
    }
    else {
        xpForRank = 0;
    }

    var xpForNextRank = settings.server.rankByXp[this.rank - 1].xp;
    var xpAchievedInRank = this.xp - xpForRank;
    var xpDiff = xpForNextRank - xpForRank;

    this.current = xpAchievedInRank;
    this.max = xpDiff;
};
