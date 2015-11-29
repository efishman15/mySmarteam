var path = require("path");
var async = require("async");
var dalDb = require(path.resolve(__dirname, "../dal/dalDb"));
var dalBranchIo = require(path.resolve(__dirname, "../dal/dalBranchIo"));
var exceptions = require(path.resolve(__dirname, "../utils/exceptions"));
var mathjs = require("mathjs");
var commonBusinessLogic = require(path.resolve(__dirname, "./common"));
var generalUtils = require(path.resolve(__dirname, "../utils/general"));
var ObjectId = require("mongodb").ObjectID;

//---------------------------------------------------------------------
// private functions
//---------------------------------------------------------------------

//setUserQuestions
function setUserQuestions(questionIndex, data, callback) {
    //Check if finished recursion cycle
    if (questionIndex === data.contest.questions.list.length) {
        setUserQuestionIds(data, callback);
        return;
    }

    if (data.mode === "add" &&
        data.contest.questions.list[questionIndex]._id !== "new" &&
        data.contest.questions.list[questionIndex].deleted
    ) {
        //Proceed to next question - when adding a new contest, and a physical question
        //Has been added and deleted, this question also belongs to another existing contest
        //Disregard this question
        setUserQuestions(questionIndex + 1, data, callback);
        return;
    }

    if (data.contest.questions.list[questionIndex]._id === "new") {

        //Add question text
        data.newQuestion = {};
        data.newQuestion.text = data.contest.questions.list[questionIndex].text;

        //Add Answers
        data.newQuestion.answers = [];
        for (var j = 0; j < data.contest.questions.list[questionIndex].answers.length; j++) {
            var answer = {"text": data.contest.questions.list[questionIndex].answers[j]};
            if (j === 0) {
                answer.correct = true;
            }
            data.newQuestion.answers.push(answer);
        }

        dalDb.insertQuestion(data, function (err, result) {

            if (err) {
                callback(new exceptions.ServerException("Error adding a new user question", data));
                return;
            }

            data.contest.questions.list[questionIndex]._id = data.newQuestion._id;

            setUserQuestions(questionIndex + 1, data, callback);
        });
    }
    else if (data.contest.questions.list[questionIndex].isDirty) {
        //Set question - update text/answers and/or associate to the current contest
        data.questionId = data.contest.questions.list[questionIndex]._id;

        data.unsetData = null;
        data.setData = {};

        if (data.contest.questions.list[questionIndex].isDirty) {

            //Question text or answers text has been modified
            data.setData.text = data.contest.questions.list[questionIndex].text;
            for (j = 0; j < data.contest.questions.list[questionIndex].answers.length; j++) {
                data.setData["answers." + j + ".text"] = data.contest.questions.list[questionIndex].answers[j];
            }

            dalDb.setQuestion(data, function(err, result) {
                if (err) {
                    callback(new exceptions.ServerException("Error updating question", data));
                    return;
                }
                setUserQuestions(questionIndex + 1, data, callback);
            });
        }
        else {
            setUserQuestions(questionIndex + 1, data, callback);
        }
    }
    else {
        setUserQuestions(questionIndex + 1, data, callback);
    }
}

//setUserQuestionIds
function setUserQuestionIds(data, callback) {
    data.contest.userQuestions = [];
    for (var i = 0; i < data.contest.questions.list.length; i++) {
        if (!data.contest.questions.list[i].deleted) {
            data.contest.userQuestions.push(data.contest.questions.list[i]._id);
        }
    }

    delete data.contest.questions;

    callback(null, data);
}


//----------------------------------------------------
// validateContestData

// data:
// input: DbHelper, contest, mode (add, edit), session
// output: modified contest with server logic
//----------------------------------------------------
function validateContestData(data, callback) {

    //Data validations

    //Empty contest
    if (!data.contest) {
        callback(new exceptions.ServerException("Contest not supplied"));
        return;
    }

    //Adding new contest is locked
    if (data.mode === "add" && data.session.features.newContest.locked) {
        callback(new exceptions.ServerException("Attempt to create a new contest without having an eligible rank or feature asset", {
            "session": data.session,
            "contest": data.contest
        }));
        return;
    }

    //Required fields
    if (!data.contest.startDate || !data.contest.endDate || !data.contest.teams || !data.contest.content) {
        callback(new exceptions.ServerException("One of the required fields not supplied: startDate, endDate, teams, content"));
        return;
    }

    //End date must be AFTER start date
    if (data.contest.startDate > data.contest.endDate) {
        callback(new exceptions.ServerException("Contest end date must be later than contest start date"));
        return;
    }

    //Status
    var now = (new Date()).getTime();

    //Cannot edit an ended contest
    if (data.contest.endDate < now && !data.session.isAdmin) {
        callback(new exceptions.ServerException("You cannot edit a contest that has already been finished", data));
    }

    //Only 2 teams are allowed
    if (data.contest.teams.length !== 2) {
        callback(new exceptions.ServerException("Number of teams must be 2"));
        return;
    }

    //One or more of the team names is missing
    if (!data.contest.teams[0].name || !data.contest.teams[1].name) {
        callback(new exceptions.ServerException("One or more of the team names are missing"));
        return;
    }

    //Teams must have different names
    if (data.contest.teams[0].name.trim() === data.contest.teams[1].name.trim()) {
        callback(new exceptions.ServerMessageException("SERVER_ERROR_TEAMS_MUST_HAVE_DIFFERENT_NAMES"));
        return;
    }

    //Only admins can set team scores
    if ((data.contest.teams[0].score || data.contest.teams[1].score) && (!data.session.isAdmin)) {
        callback(new exceptions.ServerException("Only admins are allowed to set team scores"));
        return;
    }

    //Contest _id must be supplied in edit mode
    if (data.mode === "edit" && !data.contest._id) {
        callback(new exceptions.ServerException("Contest _id not supplied in edit mode"));
        return;
    }

    //Illegal content source
    if (!data.contest.content.source || (data.contest.content.source !== "trivia" && data.contest.content.source !== "hostedGame")) {
        callback(new exceptions.ServerException("content source must be 'trivia' or 'hostedGame'", {"content": data.contest.content}));
        return;
    }

    //Illegal content category id for trivia
    if (data.contest.content.source === "trivia" &&
        (!data.contest.content.category ||
        !data.contest.content.category.id ||
        (data.contest.content.category.id !== 'system' && data.contest.content.category.id !== 'user'))) {
        callback(new exceptions.ServerException("contest.content.category.id must be 'system' or 'user'", {"content": data.contest.content}));
        return;
    }

    //User questions validations
    if (data.contest.content.source === "trivia" && data.contest.content.category.id === "user") {

        //Minimum check
        if (!data.contest.questions || data.contest.questions.visibleCount < generalUtils.settings.client.newContest.privateQuestions.min) {
            if (generalUtils.settings.client.newContest.privateQuestions.min === 1) {
                callback(new exceptions.ServerMessageException("SERVER_ERROR_MINIMUM_USER_QUESTIONS_SINGLE", {"minimum": generalUtils.settings.client.newContest.privateQuestions.min}));
            }
            else {
                callback(new exceptions.ServerMessageException("SERVER_ERROR_MINIMUM_USER_QUESTIONS_PLURAL", {"minimum": generalUtils.settings.client.newContest.privateQuestions.min}));
            }
            return;
        }

        //Maximum check
        if (data.contest.questions && data.contest.questions.visibleCount > generalUtils.settings.client.newContest.privateQuestions.max) {
            callback(new exceptions.ServerMessageException("SERVER_ERROR_MAXIMUM_USER_QUESTIONS", {"maximum": generalUtils.settings.client.newContest.privateQuestions.max}));
            return;
        }

        //Question list not supplied
        if (!data.contest.questions.list || !data.contest.questions.list.length) {
            callback(new exceptions.ServerException("questions.list must contain the array of questions"));
            return;
        }

        var questionHash = {};
        for (var i = 0; i < data.contest.questions.list.length; i++) {

            //Question must contain text
            if (!data.contest.questions.list[i].text) {
                callback(new exceptions.ServerException("Question must contain text"));
                return;
            }

            //Question must contain answers
            if (!data.contest.questions.list[i].answers || !data.contest.questions.list[i].answers.length || data.contest.questions.list[i].answers.length !== 4) {
                callback(new exceptions.ServerException("Question must contain 4 answers"));
                return;
            }

            //Count duplicate questions
            if (!data.contest.questions.list[i].deleted) {
                if (questionHash[data.contest.questions.list[i].text.trim()]) {
                    callback(new exceptions.ServerMessageException("SERVER_ERROR_QUESTION_ALREADY_EXISTS", {"question": data.contest.questions.list[i]}));
                }
                questionHash[data.contest.questions.list[i].text.trim()] = true;
            }

            //Count duplicate answers inside a question
            var answersHash = {};
            for (var j = 0; j < data.contest.questions.list[i].answers[j]; j++) {
                if (answersHash[data.contest.questions.list[i].answers[j].trim()]) {
                    callback(new exceptions.ServerMessageException("SERVER_ERROR_ENTER_DIFFERENT_ANSWERS", {"question": data.contest.questions.list[i]}));
                    return;
                }
                answersHash[data.contest.questions.list[i].answers[j].trim()] = true;
            }
        }
    }

    if (data.mode == "add") {

        var cleanContest = {};
        cleanContest.startDate = data.contest.startDate;
        cleanContest.endDate = data.contest.endDate;
        cleanContest.endOption = data.contest.endOption;
        cleanContest.participants = 0;
        cleanContest.manualParticipants = 0;
        cleanContest.manualRating = 0;
        cleanContest.teams = data.contest.teams;
        cleanContest.name = data.contest.name;
        cleanContest.language = data.session.settings.language;
        cleanContest.score = 0; //The total score gained for this contest

        cleanContest.creator = {"id" : data.session.userId, "avatar" : data.session.avatar, "name" : data.session.name, "date" : now};

        cleanContest.content = data.contest.content;
        if (cleanContest.content.source === "trivia" && cleanContest.content.category.id === "user") {
            cleanContest.questions = data.contest.questions;
        }

        if (!cleanContest.teams[0].score) {
            cleanContest.teams[0].score = 0;
        }
        if (!cleanContest.teams[1].score) {
            cleanContest.teams[1].score = 0;
        }

        //Now the data.contest object is "clean" and contains only fields that passed validation
        data.contest = cleanContest;
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

    //If team names are changing - a new link is created in branch.io with the new contest teams /name
    if (data.contest.link) {
        data.setData["link"] = data.contest.link;
    }

    data.setData.content = data.contest.content;
    if (data.contest.userQuestions) {
        data.setData.userQuestions = data.contest.userQuestions;
    }

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
    if (endMinutes >= 60 * 24) {
        contest.endsInNumber = mathjs.ceil(endMinutes / 24 / 60);
        contest.endsInUnits = "DAYS";
    }
    else if (endMinutes >= 60) {
        contest.endsInNumber = mathjs.ceil(endMinutes / 60);
        contest.endsInUnits = "HOURS";
    }
    else {
        contest.endsInNumber = mathjs.ceil(endMinutes);
        contest.endsInUnits = "MINUTES";
    }

    //starts or started
    var startMinutes = mathjs.abs(now - contest.startDate) / 1000 / 60;
    if (startMinutes >= 60 * 24) {
        contest.startsInNumber = mathjs.ceil(startMinutes / 24 / 60);
        contest.startsInUnits = "DAYS";
    }
    else if (startMinutes >= 60) {
        contest.startsInNumber = mathjs.ceil(startMinutes / 60);
        contest.startsInUnits = "HOURS";
    }
    else {
        contest.startsInNumber = mathjs.ceil(startMinutes);
        contest.startsInUnits = "MINUTES";
    }

    setContestScores(contest);

    if (contest.status !== "finished") {
        if (contest.creator.id.toString() === session.userId.toString() || session.isAdmin) {
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

//---------------------------------------------------------------------
// joinContest
//
// data:
// input: contestId, teamId
// output: modified contest with server logic
//---------------------------------------------------------------------
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
    };

    return newJoin;
}

//-----------------------------------------------------------------
// setContest
//
// data:
// input: contest, mode (add, edit), nameChanged (optional)
// output: contest (extended)
//-----------------------------------------------------------------
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

        //Add/set the contest questions (if we have)
        function (data, callback) {
            if (data.contest.questions) {
                setUserQuestions(0, data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Add/set the contest
        function (data, callback) {
            if (data.mode == "add") {
                //Join by default to the first team (on screen appears as "my team")
                joinToContestObject(data.contest, 0, data.session);
                dalDb.addContest(data, callback);
            }
            else {
                updateContest(data, callback);
            }
        },

        function (data, callback) {
            if (data.mode === "add") {
                //In case of add - contest needed to be added in the previous operation first, to get an _id
                dalBranchIo.createContestLinks(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //In case of update - create a branch link first before updating the db
        function (data, callback) {
            if (data.mode === "add") {
                //In case of add - update the links to the contest and team objects
                data.setData = {
                    "link": data.contest.link,
                    "leaderLink": data.contest.leaderLink,
                    "teams.0.link": data.contest.teams[0].link,
                    "teams.0.leaderLink": data.contest.teams[0].leaderLink,
                    "teams.1.link": data.contest.teams[1].link,
                    "teams.1.leaderLink": data.contest.teams[1].leaderLink
                };

                data.closeConnection = true;
                dalDb.setContest(data, callback);
            }
            else {
                dalDb.closeDb(data);
                callback(null, data);
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
};

//-------------------------------------------------------------------------------------
// getContests

// data:
// input: tab (myContests,runningContests,recentlyFinishedContests)
//
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

        dalDb.prepareContestsQuery,

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
// getQuestionsByIds
//
// data: userQuestions
// output: contest
//-------------------------------------------------------------------------------------
module.exports.getQuestionsByIds = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;

    if (!data.userQuestions) {
        exceptions.ServerResponseException(res, "userQuestions not supplied", null, "warn", 424);
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
            dalDb.getQuestionsByIds(data, callback);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(data.questions);
        }
        else {
            res.send(err.httpStatus, err);
        }
    });
};

//-------------------------------------------------------------------------------------
// searchMyQuestions
//
// data: text, existingQuestionIds
// output: contest
//-------------------------------------------------------------------------------------
module.exports.searchMyQuestions = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;

    if (!data.text) {
        exceptions.ServerResponseException(res, "text not supplied", null, "warn", 424);
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
            dalDb.searchMyQuestions(data, callback);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(data.questions);
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