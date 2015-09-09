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

    data.clientResponse = {};

    if (!data.contestId) {
        exceptions.ServerResponseException(res, "contestId not supplied", null, "warn", 424);
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

                //----------------------------------
                //Not joined and did not pass team
                //----------------------------------
                data.DbHelper.close();
                callback(new exceptions.ServerMessageException("SERVER_ERROR_NOT_JOINED_TO_CONTEST"));
            }
            else if ((data.teamId === 0 || data.teamId === 1) &&
                (
                    (data.contest.users == null || //nobody joined yet
                    data.contest.users[data.session.userId] == null) //I did not join
                )) {

                //----------------------------------
                //Not joined and passed a valid team
                //----------------------------------
                data.clientResponse.xpProgress.addXp(data.session, "joinContest");

                //Flagging for next function to do the join if necessary
                data.joinTeam = true;

                //Save the user to the db - session will be stored at the end of this block
                data.setData = {"xp": data.session.xp, "rank": data.session.rank};
                dalDb.setUser(data, callback);
            }
            else if ((data.teamId === 0 || data.teamId === 1) && data.contest.users[data.session.userId].team != data.teamId) { //I joined but I am switching teams now
                contestsBusinessLogic.joinContestTeam(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Check to join contest team because of switch teams
        function (data, callback) {
            if (data.joinTeam && data.joinTeam === true) {
                contestsBusinessLogic.joinContestTeam(data, callback);
            }
            else {
                callback(null, data)
            }
        },

        //Init quiz
        function (data, callback) {

            var quiz = {};
            quiz.clientData = {
                "totalQuestions": 5,
                "currentQuestionIndex": 0,
                "finished": false
            };

            quiz.serverData = {
                "previousQuestions": [],
                "topics": generalUtils.getLanguageTriviaTopics(data.session.settings.language),
                "contestId": data.contestId,
                "questionScore": (100 / quiz.clientData.totalQuestions), //Question score relational to 100
                "score": 0
            };

            data.session.quiz = quiz;

            data.clientResponse.quiz = data.session.quiz.clientData;

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
            res.send(200, data.clientResponse);
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

    data.clientResponse = {"question": {}};

    var operations = [

        //getSession
        function (callback) {
            data.token = token;
            sessionUtils.getSession(data, callback);
        },

        //Check answer
        function (data, callback) {

            if (!data.session.quiz) {
                callback(new exceptions.ServerMessageException("SERVER_ERROR_SESSION_EXPIRED_DURING_QUIZ", null, 403));
                return;
            }

            var answers = data.session.quiz.serverData.currentQuestion.answers;
            var answerId = parseInt(data.id, 10);
            if (answerId < 1 || answerId > answers.length) {
                callback(new exceptions.ServerException("Invalid answer id", {"answerId": data.id}));
            }

            data.clientResponse.question.answerId = answerId;
            if (answers[answerId - 1].correct) {
                data.clientResponse.question.correct = true;

                data.clientResponse.xpProgress.addXp(data.session, "correctAnswer");

                data.session.quiz.serverData.score += data.session.quiz.serverData.questionScore; //Question score relational to 100
            }
            else {
                data.clientResponse.question.correct = false;
                for (i = 0; i < answers.length; i++) {
                    if (answers[i].correct && answers[i].correct == true) {
                        data.clientResponse.question.correctAnswerId = i + 1;
                        break;
                    }
                }
            }

            dalDb.updateQuestionStatistics(data, callback);
        },

        //Store session
        function (data, callback) {

            var store = false;
            if (data.session.quiz.clientData.totalQuestions == data.session.quiz.clientData.currentQuestionIndex) {

                //Update total score in profile
                data.session.score += data.session.quiz.serverData.score;
                store = true;
            }
            else if (data.clientResponse.question.correct == true) {
                //store temporary score of quiz
                store = true;
            }

            if (store == true) {
                if (data.session.quiz.serverData.score == 100) {
                    data.clientResponse.xpProgress.addXp(data.session, "quizFullScore");
                }

                dalDb.storeSession(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Check to save the score into the users object as well - when quiz is finished or when got a correct answer (which gives score and/or xp
        function (data, callback) {
            if (data.session.quiz.clientData.totalQuestions == data.session.quiz.clientData.currentQuestionIndex || data.clientResponse.xpProgress.addition > 0) {

                data.setData = {
                    "score": data.session.score,
                    "xp": data.session.xp,
                    "rank": data.session.rank
                };
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

                data.clientResponse.results = {"contest": data.contest};

                contestsBusinessLogic.prepareContestForClient(data.clientResponse.results.contest, data.clientResponse.results.contest.users[data.session.userId].team, true);

                data.clientResponse.results.score = data.session.quiz.serverData.score;

                if (data.clientResponse.results.score == 100) {
                    data.clientResponse.results.sound = random.pick(quizSounds.finish.great);
                    data.clientResponse.results.title = "EXCELLENT_SCORE_TITLE";
                    data.clientResponse.results.message = "POSITIVE_SCORE_MESSAGE";
                }
                else if (data.clientResponse.results.score > 0) {
                    data.clientResponse.results.sound = random.pick(quizSounds.finish.ok);
                    data.clientResponse.results.title = "POSITIVE_SCORE_TITLE";
                    data.clientResponse.results.message = "POSITIVE_SCORE_MESSAGE";
                }
                else { //zero
                    data.clientResponse.results.sound = random.pick(quizSounds.finish.zero);
                    data.clientResponse.results.title = "ZERO_SCORE_TITLE";
                    data.clientResponse.results.message = "ZERO_SCORE_MESSAGE";
                }
            }
            callback(null, data);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.send(200, data.clientResponse);
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