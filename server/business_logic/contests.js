var async = require("async");
var dalDb = require("../dal/dalDb");
var exceptions = require("../utils/exceptions");
var mathjs = require("mathjs");
var commonBusinessLogic = require("./common");

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

    if (data.mode == "add" && data.session.features.newContest.locked) {
        callback(new exceptions.ServerException("Attempt to create a new contest without having an eligable rank or feature asset", {
            "session": data.session,
            "contest": data.contest
        }));
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

    if (data.contest.teams[0].name.trim() === data.contest.teams[1].name.trim()) {
        callback(new exceptions.ServerMessageException("SERVER_ERROR_TEAMS_MUST_HAVE_DIFFERENT_NAMES"));
        return;
    }

    if ((data.contest.teams[0].score || data.contest.teams[1].score) &&
        (!data.session.isAdmin)) {
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
        if (!data.session.isAdmin) {
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
        if (!data.session.isAdmin) {
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

function updateContest(data, callback) {

    data.checkOwner = true;

    data.setData = {};

    //Non admin fields
    data.setData["name"] = data.contest.name;
    data.setData["teams.0.name"] = data.contest.teams[0].name;
    data.setData["teams.1.name"] = data.contest.teams[1].name;
    data.setData.endDate = data.contest.endDate;

    //Admin fields
    if (data.session.isAdmin) {
        if (data.contest.teams[0].score != null) {
            data.setData["teams.0.score"] = data.contest.teams[0].score;
        }
        if (data.contest.teams[1].score != null) {
            data.setData["teams.1.score"] = data.contest.teams[1].score;
        }
        if (data.contest.manualParticipants != null) {
            data.setData["manualParticipants "] = data.contest.manualParticipants;
        }
        if (data.contest.manualRating != null) {
            data.setData["manualParticipants "] = data.contest.manualRating;
        }
    }

    dalDb.setContest(data, callback);
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
function prepareContestForClient(contest, session) {

    //Status
    var now = (new Date()).getTime();

    if (contest.users && contest.users[session.userId]) {
        contest.myTeam = contest.users[session.userId].team;
    }

    if (contest.endDate < now) {
        contest.status = "finished";
    }
    else if (contest.startDate > now) {
        contest.status = "starting";
    }
    else {
        contest.status = "running";
    }

    //ends In...or ended
    var endMinutes = mathjs.abs(contest.endDate - now) / 1000 / 60;

    var result;
    if (endMinutes >= 60 * 24) {
        result = endMinutes / 24 / 60;
        contest.endsInUnits = "DAYS";
    }
    else if (endMinutes >= 60) {
        result = endMinutes / 60;
        contest.endsInUnits = "HOURS";
    }
    else {
        result = endMinutes;
        contest.endsInUnits = "MINUTES";
    }

    contest.endsInNumber = mathjs.ceil(result);

    setContestScores(contest);

    if (contest.status !== "finished") {
        if (contest.userIdCreated === session.userId || session.isAdmin) {
            contest.owner = true;
        }
    }
    else {
        //When contest has finished - only admins can update it
        if (session.isAdmin) {
            contest.owner = true;
        }
    }

    //Fields not to be disclosed to the client
    delete contest.leader["userId"];
    delete contest["users"];
    delete contest["language"];
    delete contest["userIdCreated"];

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
    if (contest.teams[0].score === 0 && contest.teams[1].score === 0) {
        contest.teams[0].chartValue = 0.5;
        contest.teams[1].chartValue = 0.5;
    }
    else {
        //Do relational compute
        var sum = contest.teams[0].score + contest.teams[1].score;
        contest.teams[0].chartValue = mathjs.round(contest.teams[0].score / sum, 2);
        contest.teams[1].chartValue = mathjs.round(contest.teams[1].score / sum, 2);
    }
}

module.exports.joinContest = joinContest;
function joinContest(req, res, next) {

    var token = req.headers.authorization;
    var data = req.body;

    if (!data.contestId) {
        exceptions.ServerResponseException(res, "contestId not supplied", null, "warn", 424);
        return;
    }

    if (data.teamId !== 0 && data.teamId !== 1) {
        callback(new exceptions.ServerResponseException("SERVER_ERROR_NOT_JOINED_TO_CONTEST"));
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

        //Retrieve the contest
        dalDb.getContest,

        //Join the contest
        joinContestTeam,

        //Store the session's xp progress in the db
        function (data, callback) {

            prepareContestForClient(data.contest, data.session);

            data.clientResponse = {"contest": data.contest};

            if (data.newJoin) {
                commonBusinessLogic.addXp(data, "joinContest");
                data.clientResponse.xpProgress = data.xpProgress;
                dalDb.storeSession(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Store the user's xp progress in the db
        function (data, callback) {
            //Save the user to the db - session will be stored at the end of this block
            if (data.newJoin) {
                data.setData = {"xp": data.session.xp, "rank": data.session.rank};
                data.closeConnection = true;
                dalDb.setUser(data, callback);
            }
            else {
                dalDb.closeDb(data);
                callback(null, data);
            }
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(data.clientResponse);
        }
        else {
            res.send(err.httpStatus, err);
        }
    });

}

//---------------------------------------------------------------------
// joinContestTeam
// Data: contest, session, teamId
// Actual joining to the contest object and database update
//---------------------------------------------------------------------
module.exports.joinContestTeam = joinContestTeam;
function joinContestTeam(data, callback) {

    //Status
    var now = (new Date()).getTime();

    //Cannot join a contest that ended
    if (data.contest.endDate < now) {
        data.DbHelper.close();
        callback(new exceptions.ServerException("Contest has already been finished", data));
    }

    //Already joined this team - exit
    if (data.contest.users && data.contest.users[data.session.userId] && data.contest.users[data.session.userId].team === data.teamId) {
        data.DbHelper.close();
        callback(new exceptions.ServerException("Already joined to this team", data));
        return;
    }

    data.setData = {};

    //Increment participants only if I did not join this contest yet
    if (joinToContestObject(data.contest, data.teamId, data.session)) {
        data.setData.participants = data.contest.participants;
        data.newJoin = true;
        data.setData.lastParticipantJoinDate = (new Date()).getTime();
    }

    data.setData["users." + data.session.userId] = data.contest.users[data.session.userId];

    dalDb.setContest(data, callback);
}

//---------------------------------------------------------------------
// joinToContestObject
//
// Actual joining to the contest object in memory
//---------------------------------------------------------------------
function joinToContestObject(contest, teamId, session) {

    var newJoin = false;

    var now = (new Date).getTime();

    if (!contest.users) {
        contest.users = {};
        contest.leader = {"userId": session.userId, "name": session.name, "avatar": session.avatar};
    }

    //Increment participants only if I did not join this contest yet
    if (!contest.users[session.userId]) {
        contest.participants++;
        contest.lastParticipantJoinDate = now;
        newJoin = true;
    }

    if (!contest.teams[teamId].leader) {
        contest.teams[teamId].leader = {"userId": session.userId, "name": session.name, "avatar": session.avatar};
    }

    //Actual join
    contest.users[session.userId] = {
        "userId": session.userId,
        "joinDate": now,
        "team": teamId,
        "score": 0,
        "teamScores": [0, 0]
    }

    return newJoin;
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
                //Join by default to the first team (on screen appears as "my team")
                joinToContestObject(data.contest, 0, data.session);
                dalDb.addContest(data, callback);
            }
            else {
                updateContest(data, callback);
            }
        },

        //Prepare contest for client
        function (data, callback) {
            prepareContestForClient(data.contest, data.session);
            callback(null, data);
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
        exceptions.ServerResponseException(res, "contestId not supplied", null, "warn", 424);
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
            if (!data.session.isAdmin) {
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
// input: clientContestCount (how many contest does the client have currently to show,
//        tab (myContests,runningContests)
//
// output: <NA>
//-------------------------------------------------------------------------------------
module.exports.getContests = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;

    if (data.clientContestCount == null) {
        exceptions.ServerResponseException(res, "clientContestCount not supplied", null, "warn", 424);
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

        dalDb.prepareContestsQuery,

        dalDb.getContestsCount,

        //Get contests from db
        function (data, callback) {
            data.closeConnection = true;
            dalDb.getContests(data, callback);
        },

        //Set contest status for each contest
        function (data, callback) {
            for (var i = 0; i < data.contests.length; i++) {
                prepareContestForClient(data.contests[i], data.session);
            }

            callback(null, data);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json({"count": data.contestsCount, "list": data.contests});
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};

//-------------------------------------------------------------------------------------
// getContest

// data: contestId
// output: contest
//-------------------------------------------------------------------------------------
module.exports.getContest = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;

    if (!data.contestId) {
        exceptions.ServerResponseException(res, "contestId not supplied", null, "warn", 424);
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

        //Retrieve the contest
        function (data, callback) {
            data.closeConnection = true;
            dalDb.getContest(data, callback);
        },

        //Prepare contest for client
        function (data, callback) {
            prepareContestForClient(data.contest, data.session);
            callback(null, data);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(data.contest);
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};


//-------------------------------------------------------------------------------------
// getTeamDistancePercent
// returns the distance in percents (e.g. 0.02 = 2 percent) between the given team's
// score and the other's team score
//-------------------------------------------------------------------------------------
module.exports.getTeamDistancePercent = function (contest, teamId) {
    var sumScores = contest.teams[teamId].score + contest.teams[1 - teamId].score;
    var inputTeamPercent = contest.teams[teamId].score / sumScores;
    var otherTeamPercent = contest.teams[1 - teamId].score / sumScores;

    return (inputTeamPercent - otherTeamPercent);
};