var sessionUtils = require("../business_logic/session");
var async = require('async');
var exceptions = require('../utils/exceptions');
var random = require('../utils/random');
var dalDb = require('../dal/dalDb');
var generalUtils = require('../utils/general');
var contestsBusinessLogic = require('../business_logic/contests');

var quizSounds = {
    "finish": {
        "zero": ["audio/finish_zero_1", "audio/finish_zero_2"],
        "ok": ["audio/finish_ok_1"],
        "great": ["audio/finish_great_1"]
    }
}

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
// start
//
// data: contestId, teamId (optional)
//--------------------------------------------------------------------------
module.exports.start = function (req, res, next) {
    var token = req.headers.authorization;
    var data = req.body;

    if (!data.contestId) {
        exceptions.ServerResponseException(res, "contestId not supplied",null,"warn",424);
        return;
    }

    var operations = [

        //getSession
        function (callback) {
            data.token = token;
            sessionUtils.getSession(data, callback);
        },

        dalDb.getContest,

        //Check contest join and possible team switch
        function (data, callback) {
            if (data.teamId == null && (!data.contest.users || !data.contest.users[data.session.userId])) {
                data.DbHelper.close();
                callback(new exceptions.ServerMessageException("SERVER_ERROR_NOT_JOINED_TO_CONTEST"));
            }
            else if (
                (data.teamId == 0 || data.teamId == 1) &&
                (
                    (data.contest.users == null || //nobody joined yet
                    data.contest.users[data.session.userId] == null || //I did not join
                    data.contest.users[data.session.userId].team != data.teamId) //I joined but I am switching teams now
                )) {

                contestsBusinessLogic.joinContestTeam(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Init quiz
        function (data, callback) {

            var quiz = {
                "serverData": {
                    "previousQuestions": [],
                    "topics": generalUtils.getLanguageTriviaTopics(data.session.settings.language),
                    "contestId": data.contestId,
                    "score": 0
                },
                "clientData": {
                    "totalQuestions": 1,
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
            res.send(err.httpStatus, err);
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
                callback(new exceptions.ServerException("Invalid answer id", {"answerId": data.id}));
            }

            data.response = {"question": {}};

            data.response.question.answerId = answerId;
            if (answers[answerId - 1].correct) {
                data.response.question.correct = true;
                data.session.quiz.serverData.questionScore = (100 / data.session.quiz.clientData.totalQuestions); //Question score relational to 100
                data.session.quiz.serverData.score += data.session.quiz.serverData.questionScore; //Question score relational to 100
            }
            else {
                data.response.question.correct = false;
                for (i = 0; i < answers.length; i++) {
                    if (answers[i].correct && answers[i].correct == true) {
                        data.response.question.correctAnswerId = i + 1;
                        break;
                    }
                }
            }

            callback(null, data);
        },

        //Store session
        function (data, callback) {

            var store = false;
            if (data.session.quiz.clientData.totalQuestions == data.session.quiz.clientData.currentQuestionIndex) {

                //Update total score in profile
                data.session.score += data.session.quiz.serverData.questionScore;
                console.log("data.session.score=" + data.session.score + ", data.session.quiz.serverData.questionScore=" + data.session.quiz.serverData.questionScore);
                store = true;
            }
            else if (data.response.question.correct == true) {
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

                data.response.results = {"contest": data.contest};

                contestsBusinessLogic.prepareContestForClient(data.response.results.contest, data.response.results.contest.users[data.session.userId].team, true);

                data.response.results.score = data.session.quiz.serverData.score;

                if (data.response.results.score == 100) {
                    data.response.results.sound = random.pick(quizSounds.finish.great);
                    data.response.results.title = "EXCELLENT_SCORE_TITLE";
                    data.response.results.message = "POSITIVE_SCORE_MESSAGE";
                }
                else if (data.response.results.score > 0) {
                    data.response.results.sound = random.pick(quizSounds.finish.ok);
                    data.response.results.title = "POSITIVE_SCORE_TITLE";
                    data.response.results.message = "POSITIVE_SCORE_MESSAGE";
                }
                else { //zero
                    data.response.results.sound = random.pick(quizSounds.finish.zero);
                    data.response.results.title = "ZERO_SCORE_TITLE";
                    data.response.results.message = "ZERO_SCORE_MESSAGE";
                }
            }
            callback(null, data);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.send(200, data.response);
        }
        else {
            res.send(err.httpStatus, err);
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
            res.send(err.httpStatus, err);
        }
    })
};