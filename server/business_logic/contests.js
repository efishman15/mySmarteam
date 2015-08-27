var async = require("async");
var dalDb = require("../dal/dalDb");
var exceptions = require("../utils/exceptions");
var generalUtils = require('../utils/general');

//---------------------------------------------------------------------
// private functions
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// setContestStatus
//---------------------------------------------------------------------
function setContestStatus(contest) {

    var now = (new Date()).getTime();

    if (contest.endDate < now) {
        contest.status = "finished";
    }
    else if (contest.startDate > now) {
        contest.status = "starting";
    }
    else {
        contest.status = "running";
    }

    var minutesToEnd = (contest.endDate - now) / 1000 / 60;

    var result;
    if (minutesToEnd >= 60 * 24) {
        result = minutesToEnd / 24 / 60;
        contest.endsInUnits = "DAYS";
    }
    else if (minutesToEnd >= 60) {
        result = minutesToEnd / 60;
        contest.endsInUnits = "HOURS";
    }
    else {
        result = minutesToEnd;
        contest.endsInUnits = "MINUTES";
    }

    contest.endsInNumber = Math.ceil(result);
}

//----------------------------------------------------
// validateContestData

// data:
// input: DbHelper, contest, mode (add, edit), session
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
        data.contest.score = 0; //The total score gained for this contest
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

    //Do not count on status from the client
    if (data.contest.status) {
        delete data.contest.status;
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
// validateJoinContest

// data:
// input: DbHelper, contest, session, teamId, contestId
// output: modified contest with server logic
//----------------------------------------------------
function validateJoinContest(data, callback) {

    //Cannot join a contest that ended
    if (data.contest.status == "finished") {
        callback(new exceptions.GeneralError(424, "Contest: " + data.contestId + " has already been finished"));
    }

    //Already joined the contest to that same team
    if (data.contest.users &&
        data.contest.users[data.session.userId] &&
        data.contest.users[data.session.userId].team == data.teamId) {
        callback(new exceptions.GeneralError(424, "You have already joined contest: " + data.contestId + ", to the same team: " + data.contest.teams[data.teamId].name));
    }

    //Already joined the contest, cannot switch teams if score>0
    if (data.contest.users &&
        data.contest.users[data.session.userId] &&
        data.contest.users[data.session.userId].team != data.teamId && data.contest.users[data.session.userId].score > 0) {
        callback(new exceptions.GeneralError(424, "Contest: " + data.contestId + ", cannot switch to the " + data.contest.teams[data.teamId].name + " if you already played for the " + data.contest.teams[1-data.teamId].name));
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
        validateContestData,

        //Add/set the contest
        function (data, callback) {
            data.closeConnection = true;
            if (data.mode == "add") {
                dalDb.addContest(data, callback);
            }
            else {
                data.setData = data.contest;
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
        res.send(424, "contestId not supplied");
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
}

//-------------------------------------------------------------------------------------
// getContests

// data:
// input: TODO: In the future - tab: 0=myContest, 1=openContests, 2=closedContests
// output: <NA>
//-------------------------------------------------------------------------------------
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

        //Get contests from db
        function (data, callback) {
            data.closeConnection = true;
            data.setContestStatusCallBack = setContestStatus;
            dalDb.getContests(data, callback);
        },

        //Set contest status for each contest
        function(data, callback) {
            data.contestsHash = {};
            for (var i = 0; i < data.contests.length; i++) {

                if (data.contests[i].users && data.contests[i].users[data.session.userId]) {
                    data.contests[i].myTeam = data.contests[i].users[data.session.userId].team;
                }

                setContestStatus(data.contests[i]);

                data.contestsHash[data.contests[i]._id] = data.contests[i];
            }

            callback(null, data);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(data.contestsHash)
        }
        else {
            res.send(err.status, err);
        }
    });
}

///--------------------------------------------------------------
// validateContestData
//
// data:
// input: contestId, teamId
// output: <NA>
//---------------------------------------------------------------
module.exports.joinContest = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;

    if (!data.contestId) {
        res.send(424, "contestId not supplied");
        return;
    }

    if (data.teamId != 0 && data.teamId != 1) {
        res.send(424, "teamId can be either 0 or 1");
        return;
    }

    var now = (new Date).getTime();

    var operations = [

        //Connect to the database (so connection will stay open until we decide to close it)
        dalDb.connect,

        //Retrieve the session
        function (connectData, callback) {
            data.DbHelper = connectData.DbHelper;
            data.token = token;
            dalDb.retrieveSession(data, callback);
        },

        //Get the contest object - to make sure this contest exists
        function (data, callback) {
            dalDb.getContest(data, callback);
        },

        //Check that I can join this contest
        validateJoinContest,

        //Join to the contest in the contest object
        function (data, callback) {

            if (!data.contest.users) {
                data.contest.users = {};
            }

            data.setData = {};

            //Increment participants only if I did not join this contest yet
            if (!data.contest.users[data.session.userId]) {
                data.contest.participants++;
                data.setData.participants = data.contest.participants;
            }

            //Actual join
            data.contest.users[data.session.userId] = {
                "userId": data.session.userId,
                "joinDate": now,
                "team" : data.teamId,
                "score": 0,
            }
            data.setData.users = data.contest.users;

            data.contest.lastParticipantJoinDate = now;
            data.setData.lastParticipantJoinDate = now;

            data.closeConnection = true;

            dalDb.setContest(data, callback);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            data.contest.myTeam = data.teamId; //Only needed for the client
            setContestStatus(data.contest);
            res.json(data.contest)
        }
        else {
            res.send(err.status, err);
        }
    });
}