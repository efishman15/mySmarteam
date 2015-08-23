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

    if ((data.contest.teams[0].score || data.contest.teams[1].score) &&
        (!data.session.isAdmin || data.session.isAdmin == false)) {
        callback(new exceptions.GeneralError(424), "Only admins are allowed to set team scores");
        return;
    }

    if (data.mode == "edit" && !data.contest._id) {
        callback(new exceptions.GeneralError(424), "Contest _id not supplied in edit mode");
        return;
    }

    if (data.mode == "add") {
        data.contest.language = data.session.settings.language;
        data.contest.participants = 0;
        data.contest.userIdCreated = data.session.userId;
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
            data.DbHelper = connectData.DbHelper;
            data.token = token;
            dalDb.retrieveSession(data, callback);
        },

        //Check contest fields and extend from with server side data
        function (data, callback) {
            data.mode = "add";
            validateContestData(data, callback);
        },

        //Add the contest
        function (data, callback) {
            data.closeConnection = true;
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
            data.DbHelper = connectData.DbHelper;
            data.token = token;
            dalDb.retrieveSession(data, callback);
        },

        //Check contest fields and extend from with server side data
        function (data, callback) {
            data.mode = "edit";
            validateContestData(data, callback);
        },

        //Add the contest
        function (data, callback) {
            data.closeConnection = true;
            dalDb.setContest(data, callback);
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
