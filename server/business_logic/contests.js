var async = require("async");
var dalDb = require("../dal/dalDb");
var exceptions = require("../utils/exceptions");

function validateContestData(data, callback) {

    //Data validations
    if (!data.contest) {
        callback(new exceptions.GeneralError(424), "Contest not supplied");
        return;
    }

    if (!data.contest.name || !data.contest.startDate || !data.contest.endDate || data.contest.teams) {
        callback(new exceptions.GeneralError(424), "One of the required fields not supplied: name, startDate, endDate, teams");
        return;
    }

    if (data.contest.teams.length != 2) {
        callback(new exceptions.GeneralError(424), "Number of teams must be 2");
        return;
    }

    if (!data.contest.teams[0].name || !data.contest.teams[1].name) {
        callback(new exceptions.GeneralError(424), "One or more of the team names are missing");
        return;
    }

    if (data.contest.teams[0].score && )

    data.contest.language = data.session.settings.language;
    if (data.contest.manualParticipants) {
        if (!data.session.isAdmin || data.session.isAdmin == false) {
            //Allowed only for admins
            delete data.contest.manualParticipants;
        }
    }
    else {
        data.contest.manualParticipants = 0;
    }

    data.contest.participants = 0;
    data.contes.userIdCreated = data.session.userId;

    if (data.contest.manualRating) {
        if (!data.session.isAdmin || data.session.isAdmin == false) {
            //Allowed only for admins
            delete data.contest.manualRating;
        }
    }
    else {
        data.contest.manualRating = 0;
    }
}

//----------------------------------------------------
// addContest

// data:
// input: contest
// output: contest (extended)
//----------------------------------------------------
module.exports.addContest = function (req, res, next) {

    var token = req.headers.authorization;
    var data = req.body;

    var operations = [

        //Connect to the database (so connection will stay open until we decide to close it)
        dalDb.connect,

        //Retrieve the session
        function (connectData, callback) {
            data.dbHelper = connectData.dbHelper;
            data.token = token;
            dalDb.retrieveSession(data, callback);
        },

        //Check contest fields and extend from with server side data
        function (data, callback) {

            //Data validations
            if (!data.contest) {
                callback(new exceptions.GeneralError(424), "Contest not supplied");
                return;
            }

            if (!data.contest.name || !data.contest.startDate || !data.contest.endDate || data.contest.teams) {
                callback(new exceptions.GeneralError(424), "One of the required fields not supplied: name, startDate, endDate, teams");
                return;
            }

            if (data.contest.teams.length != 2) {
                callback(new exceptions.GeneralError(424), "Number of teams must be 2");
                return;
            }

            if (!data.contest.teams[0].name || !data.contest.teams[1].name) {
                callback(new exceptions.GeneralError(424), "One or more of the team names are missing");
                return;
            }

            data.contest.language = data.session.settings.language;
            if (data.contest.manualParticipants) {
                if (!data.session.isAdmin || data.session.isAdmin == false) {
                    //Allowed only for admins
                    delete data.contest.manualParticipants;
                }
            }
            else {
                data.contest.manualParticipants = 0;
            }

            data.contest.participants = 0;
            data.contes.userIdCreated = data.session.userId;

            if (data.contest.manualRating) {
                if (!data.session.isAdmin || data.session.isAdmin == false) {
                    //Allowed only for admins
                    delete data.contest.manualRating;
                }
            }
            else {
                data.contest.manualRating = 0;
            }

            dalDb.addContest(data, callback);

        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(data.contest)
        }
        else {
            res.send(err.status, err);
        }
    });
};

//---------------------------------------------------------------
// setContest

// data:
// input: contest
// output: contest (most updated from db - with team scores)
//---------------------------------------------------------------
module.exports.setContest = function (req, res, next) {

    var token = req.headers.authorization;
    var data = req.body;

    var operations = [

        //Connect to the database (so connection will stay open until we decide to close it)
        dalDb.connect,

        //Retrieve the session
        function (connectData, callback) {
            data.dbHelper = connectData.dbHelper;
            data.token = token;
            dalDb.retrieveSession(data, callback);
        },

        //Check contest fields and extend from with server side data
        function (data, callback) {

            //Data validations
            if (!data.contest) {
                callback(new exceptions.GeneralError(424), "Contest not supplied");
                return;
            }

            if (!data.contest.name || !data.contest.startDate || !data.contest.endDate || data.contest.teams) {
                callback(new exceptions.GeneralError(424), "One of the required fields not supplied: name, startDate, endDate, teams");
                return;
            }

            if (data.contest.teams.length != 2) {
                callback(new exceptions.GeneralError(424), "Number of teams must be 2");
                return;
            }

            if (!data.contest.teams[0].name || !data.contest.teams[1].name) {
                callback(new exceptions.GeneralError(424), "One or more of the team names are missing");
                return;
            }

            data.contest.language = data.session.settings.language;
            if (data.contest.manualParticipants) {
                if (!data.session.isAdmin || data.session.isAdmin == false) {
                    //Allowed only for admins
                    delete data.contest.manualParticipants;
                }
            }
            else {
                data.contest.manualParticipants = 0;
            }

            data.contest.participants = 0;
            data.contes.userIdCreated = data.session.userId;

            if (data.contest.manualRating) {
                if (!data.session.isAdmin || data.session.isAdmin == false) {
                    //Allowed only for admins
                    delete data.contest.manualRating;
                }
            }
            else {
                data.contest.manualRating = 0;
            }

            dalDb.addContest(data, callback);

        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(data.contest)
        }
        else {
            res.send(err.status, err);
        }
    });
};
