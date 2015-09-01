var async = require("async");
var dalDb = require("../dal/dalDb");
var exceptions = require("../utils/exceptions");
var mathjs = require("mathjs");

//---------------------------------------------------------------------
// private functions
//---------------------------------------------------------------------

//----------------------------------------------------
// validateContestData

// data:
// input: DbHelper, contest, mode (add, edit), session
// output: modified contest with server logic
//----------------------------------------------------
function validateContestData(data, callback) {

    //Data validations
    if (!data.contest) {
        callback(new exceptions.ServerException("Contest not supplied"));
        return;
    }

    if (!data.contest.startDate || !data.contest.endDate || !data.contest.teams) {
        callback(new exceptions.ServerException("One of the required fields not supplied: startDate, endDate, teams"));
        return;
    }

    if (data.contest.startDate > data.contest.endDate) {
        callback(new exceptions.ServerException("Contest end date must be later than contest start date"));
        return;
    }

    if (data.contest.teams.length != 2) {
        callback(new exceptions.ServerException("Number of teams must be 2"));
        return;
    }

    if (!data.contest.teams[0].name || !data.contest.teams[1].name) {
        callback(new exceptions.ServerException("One or more of the team names are missing"));
        return;
    }

    if ((data.contest.teams[0].score || data.contest.teams[1].score) &&
        (!data.session.isAdmin || data.session.isAdmin == false)) {
        callback(new exceptions.ServerException("Only admins are allowed to set team scores"));
        return;
    }

    if (data.mode == "edit" && !data.contest._id) {
        callback(new exceptions.ServerException("Contest _id not supplied in edit mode"));
        return;
    }

    if (data.mode == "add") {
        data.contest.language = data.session.settings.language;
        data.contest.participants = 0;
        data.contest.score = 0; //The total score gained for this contest
        data.contest.userIdCreated = data.session.userId;
        if (!data.contest.teams[0].score) {
            data.contest.teams[0].score = 0;
        }
        if (!data.contest.teams[1].score) {
            data.contest.teams[1].score = 0;
        }
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


    callback(null, data);
}

//---------------------------------------------------------------------
// prepareContestForClient
//
// Updates:
// 1. Status field (finished, starting, running)
// 2. Ends in fields.
// 3. Chart values as a result of a score change
//---------------------------------------------------------------------
module.exports.prepareContestForClient = prepareContestForClient;
function prepareContestForClient(contest, myTeamId, addLastPlayedStamp) {

    //Status
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

    if (addLastPlayedStamp == true) {
        contest.lastPlayed = now;
    }

    //ends In...
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

    contest.endsInNumber = mathjs.ceil(result);

    setContestScores(contest);

    contest.myTeam = myTeamId;

    //Fields not to be disclosed to the client
    delete contest["users"];
    delete contest["language"];

}

//---------------------------------------------------------------------
// setContestScores
//
// Updates:
// Chart values as a result of a score change
//---------------------------------------------------------------------
module.exports.setContestScores = setContestScores;
function setContestScores(contest) {

    //Chart values
    if (contest.teams[0].score == 0 && contest.teams[1].score == 0) {
        contest.teams[0].chartValue = 0.5;
        contest.teams[1].chartValue = 0.5;
    }
    else {
        //Do relational compute
        var sum = contest.teams[0].score + contest.teams[1].score;
        contest.teams[0].chartValue = mathjs.round(contest.teams[0].score / sum,2);
        contest.teams[1].chartValue = mathjs.round(contest.teams[1].score / sum,2);
    }
}

//Join to the contest in the contest object
module.exports.joinContestTeam = joinContestTeam;
function joinContestTeam(data, callback) {

    //Cannot join a contest that ended
    if (data.contest.status == "finished") {
        callback(new exceptions.ServerException("Contest has already been finished", data));
    }

    var now = (new Date).getTime();

    if (!data.contest.users) {
        data.contest.users = {};
    }

    data.setData = {};

    //Increment participants only if I did not join this contest yet
    if (!data.contest.users[data.session.userId]) {
        data.contest.participants++;
        data.setData.participants = data.contest.participants;

        data.contest.lastParticipantJoinDate = now;
        data.setData.lastParticipantJoinDate = now;
    }

    //Actual join
    data.contest.users[data.session.userId] = {
        "userId": data.session.userId,
        "joinDate": now,
        "team" : data.teamId,
        "score": 0,
    }

    data.setData["users." + data.session.userId]  = data.contest.users[data.session.userId];

    dalDb.setContest(data, callback);
}


//----------------------------------------------------
// setContest
//
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
            res.send(err.httpStatus, err);
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
        exceptions.ServerResponseException(res, "contestId not supplied",null,"warn",424);
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
                callback(new exceptions.ServerException("Removing contest is allowed only for administrators", data));
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
            res.send(err.httpStatus, err);
        }
    });
}

//-------------------------------------------------------------------------------------
// getContests

// data:
// input: clientContestCount (how many contest does the client have currently to show
// TODO: In the future - tab: 0=myContest, 1=openContests, 2=closedContests
// output: <NA>
//-------------------------------------------------------------------------------------
module.exports.getContests = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;

    if (data.clientContestCount == null) {
        exceptions.ServerResponseException(res, "clientContestCount not supplied",null,"warn",424);
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

        dalDb.prepareContestsCriteria,

        dalDb.getContestsCount,

        //Get contests from db
        function (data, callback) {
            data.closeConnection = true;
            dalDb.getContests(data, callback);
        },

        //Set contest status for each contest
        function(data, callback) {
            for (var i = 0; i < data.contests.length; i++) {

                if (data.contests[i].users && data.contests[i].users[data.session.userId]) {
                    data.contests[i].myTeam = data.contests[i].users[data.session.userId].team;
                }

                var myTeam = null;
                if (data.contests[i].users && data.contests[i].users[data.session.userId]) {
                    myTeam = data.contests[i].users[data.session.userId].team;
                }
                prepareContestForClient(data.contests[i], myTeam);
            }

            callback(null, data);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json({"count" : data.contestsCount, "list" : data.contests});
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
}