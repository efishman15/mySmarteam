var path = require("path");
var exceptions = require(path.resolve(__dirname,"../utils/exceptions"));
var generalUtils = require(path.resolve(__dirname,"../utils/general"));
var sessionUtils = require(path.resolve(__dirname,"./session"));
var logger = require(path.resolve(__dirname,"../utils/logger"));
var async = require("async");
var dalHttp = require(path.resolve(__dirname,"../dal/dalHttp"));
var dalDb = require(path.resolve(__dirname,"../dal/dalDb"));
var cache = require(path.resolve(__dirname,"../utils/cache"));

var HOSTED_GAMES_API_PREFIX = "https://games.gamepix.com/";

//--------------------------------------------------------------------------
// getCategories
//
// data: <NA>
//--------------------------------------------------------------------------
module.exports.getCategories = function (req, res, next) {

    var token = req.headers.authorization;
    var data = req.body;

    var operations = [

        //getSession
        function (callback) {
            data.token = token;
            sessionUtils.getSession(data, callback);
        },

        //Retrieve categories either from cache or from the hosted games api
        function (data, callback) {

            if (!generalUtils.settings.server.hostedGames.active ||
                (generalUtils.settings.server.hostedGames.forAdminsOnly && !data.session.isAdmin)) {
                data.hostedGamesCategories = {};
                callback(null, data);
                return;
            }

            var categories = cache.get("categories");

            if (categories ) {
                data.hostedGamesCategories = categories;
                callback(null, data);
            }
            else {
                var options = {
                    "url": HOSTED_GAMES_API_PREFIX + "categories",
                    "json" : true
                };

                dalHttp.get(options, function (hostedGamesCategories) {
                    data.hostedGamesCategories = {};
                    for (var i=0; i<hostedGamesCategories.data.length; i++) {
                        data.hostedGamesCategories["" + hostedGamesCategories.data[i].id] = hostedGamesCategories.data[i];
                    }
                    cache.set("categories", data.hostedGamesCategories);
                    dalDb.closeDb(data);
                    callback(null, data);
                });
            }
        }
    ];

    async.waterfall(operations, function (err) {
        if (!err) {
            res.json(data.hostedGamesCategories);
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};

//--------------------------------------------------------------------------
// getGames
//
// data: categoryId
//--------------------------------------------------------------------------
module.exports.getGames = function (req, res, next) {

    var token = req.headers.authorization;
    var data = req.body;

    if (!data.categoryId) {
        exceptions.ServerResponseException(res, "categoryId not supplied", null, "warn", 424);
        return;
    }

    var categories = cache.get("categories");

    if (!categories) {
        exceptions.ServerResponseException(res, "Trying to retrieve games from category while categories not yet retrieved", data, "warn", 424);
        return;
    }

    if (!categories["" + data.categoryId]) {
        exceptions.ServerResponseException(res, "Trying to retrieve games from category while category does not exist", {"categories": categories, "data" : data}, "warn", 424);
        return;
    }

    var operations = [

        //getSession
        function (callback) {
            data.token = token;
            sessionUtils.getSession(data, callback);
        },

        //Retrieve games either from cache or from hosted games api
        function (data, callback) {

            if (!generalUtils.settings.server.hostedGames.active ||
                (generalUtils.settings.server.hostedGames.forAdminsOnly && !data.session.isAdmin)) {
                data.hostedGames = {};
                callback(null, data);
                return;
            }

            var games = categories["" + data.categoryId].games;
            if (games) {
                data.hostedGames = games;
                callback(null, data);
            }
            else {
                var options = {
                    "url": HOSTED_GAMES_API_PREFIX + "games",
                    "qs" : {"category" : data.categoryId},
                    "json" : true
                };

                dalHttp.get(options, function (hostedGames) {
                    data.hostedGames = [];
                    for (var i=0; i<hostedGames.data.length; i++) {
                        if (hostedGames.data[i].orientation === "portrait") {
                            data.hostedGames.push(hostedGames.data[i]);
                        }
                    }
                    categories["" + data.categoryId].games = data.hostedGames;
                    dalDb.closeDb(data);
                    callback(null, data);
                });
            }
        }
    ];

    async.waterfall(operations, function (err) {
        if (!err) {
            res.json(data.hostedGames);
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};
