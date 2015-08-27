var async = require("async");
var dalDb = require("../dal/dalDb");
var exceptions = require("../utils/exceptions");
var generalUtils = require('../utils/general');

//----------------------------------------------------
// validateContestData

// data:
// input: contest, mode (add, edit), session
// output: modified contest with server logic
//----------------------------------------------------
function validateContestData(data, callback) {

    //Data validations
    if (!data.contest) {
        callback(new exceptions.GeneralError(424), "Contest not supplied");
        return;
    }

    if (!data.contest.startDate || !data.contest.endDate || !data.contest.teams) {
        callback(new exceptions.GeneralError(424, "One of the required fields not supplied: startDate, endDate, teams"));
        return;
    }

    if (data.contest.startDate > data.contest.endDate) {
        callback(new exceptions.GeneralError(424, "Contest end date must be later than contest start date"));
        return;
    }

    if (data.contest.teams.length != 2) {
        callback(new exceptions.GeneralError(424, "Number of teams must be 2"));
        return;
    }

    if (!data.contest.teams[0].name || !data.contest.teams[1].name) {
        callback(new exceptions.GeneralError(424, "One or more of the team names are missing"));
        return;
    }

    if ((data.contest.teams[0].score || data.contest.teams[1].score) &&
        (!data.session.isAdmin || data.session.isAdmin == false)) {
        callback(new exceptions.GeneralError(424, "Only admins are allowed to set team scores"));
        return;
    }

    if (data.mode == "edit" && !data.contest._id) {
        callback(new exceptions.GeneralError(424, "Contest _id not supplied in edit mode"));
        return;
    }

    if (data.mode == "add") {
        data.contest.language = data.session.settings.language;
        data.contest.participants = 0;
        data.contest.userIdCreated = data.session.userId;
        data.contest.lastParticipantJoined = null;
        if (!data.contest.teams[0].score) {
            data.contest.teams[0].score = 0;
        }
        if (!data.contest.teams[1].score) {
            data.contest.teams[1].score = 0;
        }
    }

    //Set chart values based on team scores
    if (data.contest.teams[0].score == 0 && data.contest.teams[1].score == 0) {
        data.contest.teams[0].chartValue = 0.5;
        data.contest.teams[1].chartValue = 0.5;
    }
    else {
        //Do relational compute
        var sum = data.contest.teams[0].score + data.contest.teams[1].score;
        data.contest.teams[0].chartValue = Math.round(data.contest.teams[0].score * 100 / sum) / 100;
        data.contest.teams[1].chartValue = 1 - data.contest.teams[0].chartValue;
    }

    if (data.contest.manualParticipants) {
        if (!data.session.isAdmin || data.session.isAdmin == false) {
            //Allowed only for admins
            delete data.contest.manualParticipants;
        }
    }
    else {
        if (data.mode == "add") {
            data.contest.manualParticipants = 0;
        }
    }

    if (data.contest.manualRating) {
        if (!data.session.isAdmin || data.session.isAdmin == false) {
            //Allowed only for admins
            delete data.contest.manualRating;
        }
    }
    else {
        if (data.mode == "add") {
            data.contest.manualRating = 0;
        }
    }

    callback(null, data);
}

//----------------------------------------------------
// setContest

// data:
// input: contest, mode (add, edit)
// output: contest (extended)
//----------------------------------------------------
module.exports.setContest = function (req, res, next) {

    var token = req.headers.authorization;
    var data = req.body;

    var operations = [

        //Connect to the database (so connection will stay open until we decide to close it)
        dalDb.connect,

        //Retrieve the session
        function (connectData, callback) {
            data.DbHelper = connectData.DbHelper;
            data.token = token;
            dalDb.retrieveSession(data, callback);
        },

        //Check contest fields and extend from with server side data
        function (data, callback) {
            validateContestData(data, callback);
        },

        //Add/set the contest
        function (data, callback) {
            data.closeConnection = true;
            if (data.mode == "add") {
                dalDb.addContest(data, callback);
            }
            else {
                dalDb.setContest(data, callback);
            }
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
// removeContest

// data:
// input: contestId
// output: <NA>
//---------------------------------------------------------------
module.exports.removeContest = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;

    if (!data.contestId) {
        res.send(500, "ContestId not supplied");
        return;
    }

    var operations = [

        //Connect to the database (so connection will stay open until we decide to close it)
        dalDb.connect,

        //Retrieve the session
        function (connectData, callback) {
            data.DbHelper = connectData.DbHelper;
            data.token = token;
            dalDb.retrieveSession(data, callback);
        },

        //Check that only admins are allowed to remove a contest
        function (data, callback) {
            if (!data.session.isAdmin || data.session.isAdmin == false) {
                callback(new exceptions.GeneralError(424), "Removing contest is allowed only for administrators");
                return;
            }
            data.closeConnection = true;
            dalDb.removeContest(data, callback);
        },

    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(data.contest)
        }
        else {
            res.send(err.status, err);
        }
    });
}

//---------------------------------------------------------------
// getContests

// data:
// input: TODO: In the future - tab: 0=myContest, 1=openContests, 2=closedContests
// output: <NA>
//---------------------------------------------------------------
module.exports.getContests = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;

    var operations = [

        //Connect to the database (so connection will stay open until we decide to close it)
        dalDb.connect,

        //Retrieve the session
        function (connectData, callback) {
            data.DbHelper = connectData.DbHelper;
            data.token = token;
            dalDb.retrieveSession(data, callback);
        },

        //Check that only admins are allowed to remove a contest
        function (data, callback) {
            data.closeConnection = true;
            dalDb.getContests(data, callback);
        },
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(data.contests)
        }
        else {
            res.send(err.status, err);
        }
    });
}