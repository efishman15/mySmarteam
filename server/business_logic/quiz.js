var sessionUtils = require("../business_logic/session");
var async = require('async');
var exceptions = require('../utils/exceptions');
var random = require('../utils/random');
var dalDb = require('../dal/dalDb');
var generalUtils = require('../utils/general');
var contestsBusinessLogic = require('../business_logic/contests');

//--------------------------------------------------------------------------
//Private functions
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// setQuestionDirection
//
// data: session
//--------------------------------------------------------------------------
function setQuestionDirection(data, callback) {

    data.topicId = data.session.quiz.serverData.currentQuestion.topicId;
    dalDb.getTopic(data, function (err, topic) {
        if (err) {
            callback(err);
            return;
        }
        if (topic.forceDirection) {
            data.session.quiz.clientData.currentQuestion.direction = topic.forceDirection;
        }
        else {
            data.session.quiz.clientData.currentQuestion.direction = generalUtils.getDirectionByLanguage(data.session.settings.language);
        }

        callback(null, data);

    });
}

//--------------------------------------------------------------------------
// subjects
//
// data: language
//--------------------------------------------------------------------------
module.exports.subjects = function (req, res, next) {

    var token = req.headers.authorization;
    var data = req.body;

    var operations = [

        dalDb.connect,

        //get subjects
        function (connectData, callback) {
            data.DbHelper = connectData.DbHelper;
            data.isServerSide = false;
            data.closeConnection = true;
            dalDb.getSubjects(data, callback);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.json(data.subjects);
        }
        else {
            res.send(err.status, err);
        }
    })
};

//--------------------------------------------------------------------------
// start
//
// data: contestId
//--------------------------------------------------------------------------
module.exports.start = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;

    var operations = [

        //getSession
        function (callback) {
            data.token = token;
            sessionUtils.getSession(data, callback);
        },

        dalDb.getContest,

        //Init quiz
        function (data, callback) {
            if (!data.contest.users || !data.contest.users[data.session.userId]) {
                data.DbHelper.close();
                callback(new exceptions.GeneralError(424, "ErrorNotJoinedToContest"));
            }

            var quiz = {
                "serverData": {
                    "previousQuestions": [],
                    "topics": generalUtils.getLanguageTriviaTopics(data.session.settings.language),
                    "contestId": data.contestId,
                    "score": 0
                },
                "clientData": {
                    "totalQuestions": 5,
                    "currentQuestionIndex": 0,
                    "finished": false
                }
            };

            data.session.quiz = quiz;

            callback(null, data);

        },

        //Pick a random subject from the avilable subjects in this quiz and prepare the query
        dalDb.prepareQuestionCriteria,

        //Count number of questions excluding the previous questions
        dalDb.getQuestionsCount,

        //Get the next question for the quiz
        dalDb.getNextQuestion,

        //Sets the direction of the question
        setQuestionDirection,

        //Stores the session with the quiz in the db
        function (data, callback) {
            data.closeConnection = true;
            dalDb.storeSession(data, callback);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.send(200, data.session.quiz.clientData);
        }
        else {
            res.send(err.status, err);
        }
    })
};

//--------------------------------------------------------------------------
// answer
//
// data: id (answerId)
//--------------------------------------------------------------------------
module.exports.answer = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;

    var operations = [

        //getSession
        function (callback) {
            data.token = token;
            sessionUtils.getSession(data, callback);
        },

        //Check answer
        function (data, callback) {
            var answers = data.session.quiz.serverData.currentQuestion.answers;
            var answerId = parseInt(data.id, 10);
            if (answerId < 1 || answerId > answers.length) {
                callback(new excptions.GeneralError(424, "Invalid answer id: " + data.id));
            }

            data.result = {};

            data.result.answerId = answerId;
            if (answers[answerId - 1].correct) {
                data.result.correct = true;
                data.session.quiz.serverData.score += (100 / data.session.quiz.clientData.totalQuestions); //Question score relational to 100
            }
            else {
                data.result.correct = false;
                for (i = 0; i < answers.length; i++) {
                    if (answers[i].correct && answers[i].correct == true) {
                        data.result.correctAnswerId = i + 1;
                        break;
                    }
                }
            }

            data.result.score = data.session.quiz.serverData.score;
            callback(null, data);
        },

        //Store session
        function (data, callback) {

            var store = false;
            if (data.session.quiz.clientData.totalQuestions == data.session.quiz.clientData.currentQuestionIndex) {

                //Update total score in profile
                data.session.score += data.session.quiz.serverData.score;
                store = true;
            }
            else if (data.result.correct == true) {
                //store temporary score of quiz
                store = true;
            }

            if (store == true) {
                dalDb.storeSession(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Check to save the score into the users object as well - when quiz is finished
        function (data, callback) {
            if (data.session.quiz.clientData.totalQuestions == data.session.quiz.clientData.currentQuestionIndex) {
                data.setData = {"score": data.session.score};
                dalDb.setUser(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Retrieve the contest object - when quiz is finished
        function (data, callback) {
            if (data.session.quiz.clientData.totalQuestions == data.session.quiz.clientData.currentQuestionIndex) {
                data.contestId = data.session.quiz.serverData.contestId;
                dalDb.getContest(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Check to save the quiz score into the contest object - when quiz is finished
        function (data, callback) {
            if (data.session.quiz.clientData.totalQuestions == data.session.quiz.clientData.currentQuestionIndex) {

                //Update:
                // 1. contest general score
                // 2. My score in this contest + lastPlayed
                // 3. My team's score in this contest
                data.setData = {};
                data.setData["users." + data.session.userId + ".score"] = data.contest.users[data.session.userId].score + data.session.quiz.serverData.score;
                data.setData["users." + data.session.userId + ".lastPlayed"] = (new Date()).getTime();
                data.setData.score = data.contest.score + data.session.quiz.serverData.score;

                data.contest.teams[data.contest.users[data.session.userId].team].score += data.session.quiz.serverData.score;
                data.setData["teams." + data.contest.users[data.session.userId].team + ".score"] = data.contest.teams[data.contest.users[data.session.userId].team].score;

                data.result.contest = data.contest;

                data.closeConnection = true;
                dalDb.setContest(data, callback);
            }
            else {
                dalDb.closeDb(data);
                callback(null, data);
            }
        },

        //Set contest status fields (required for client only),
        //AFTER contest has been saved to db
        function (data, callback) {
            if (data.session.quiz.clientData.totalQuestions == data.session.quiz.clientData.currentQuestionIndex) {
                contestsBusinessLogic.prepareContestForClient(data.result.contest, data.result.contest.users[data.session.userId].team);
            }
            callback(null, data);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.send(200, data.result);
        }
        else {
            res.send(err.status, err);
        }
    })
};

//--------------------------------------------------------------------------
// nextQuestion
//
// data: <NA>
//--------------------------------------------------------------------------
module.exports.nextQuestion = function (req, res, next) {
    var token = req.headers.authorization;
    var data = {};
    var operations = [

        //getSession
        function (callback) {
            data.token = token;
            sessionUtils.getSession(data, callback);
        },

        //Will pick a random topic from the trivia topics for the current language and prepare the query
        dalDb.prepareQuestionCriteria,

        //Count number of questions excluding the previous questions
        dalDb.getQuestionsCount,

        //Get the next question for the quiz
        dalDb.getNextQuestion,

        //Sets the direction of the question
        setQuestionDirection,

        //Stores the session with the quiz in the db
        function (data, callback) {
            data.closeConnection = true;
            dalDb.storeSession(data, callback);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.send(200, data.session.quiz.clientData);
        }
        else {
            res.send(err.status, err);
        }
    })
};