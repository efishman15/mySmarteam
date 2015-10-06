var sessionUtils = require("../business_logic/session");
var async = require("async");
var exceptions = require("../utils/exceptions");
var random = require("../utils/random");
var dalDb = require("../dal/dalDb");
var generalUtils = require("../utils/general");
var contestsBusinessLogic = require("../business_logic/contests");
var leaderboards = require("../business_logic/leaderboards");

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

function addXp(data, action) {
    if (!data.clientResponse) {
        data.clientResponse = {};
    }

    if (!data.clientResponse.xpProgress) {
        data.clientResponse.xpProgress = new generalUtils.XpProgress(data.session.xp, data.session.rank);
    }

    data.clientResponse.xpProgress.addXp(data.session, "joinContest");

}

//--------------------------------------------------------------------------
//Public functions
//--------------------------------------------------------------------------

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
                addXp(data, "joinContest");

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
            if (data.joinTeam && data.joinTeam) {
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
                "totalQuestions": generalUtils.settings.client.quiz.questions.score.length,
                "currentQuestionIndex": -1, //First question will be incremented to 0
                "finished": false
            };

            quiz.serverData = {
                "previousQuestions": [],
                "contestId": data.contestId,
                "score": 0,
                "correctAnswers" : 0
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
// data: id (answerId), hintUsed (optional), answerUsed (optional)
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

                data.session.quiz.serverData.correctAnswers++;

                addXp(data, "correctAnswer");

                var questionScore = generalUtils.settings.server.quiz.questions.levels[data.session.quiz.clientData.currentQuestionIndex].score;
                if (data.answerUsed && data.session.quiz.clientData.currentQuestion.answerCost) {
                    questionScore -= data.session.quiz.clientData.currentQuestion.answerCost;
                }
                else if (data.hintUsed && data.session.quiz.clientData.currentQuestion.hintCost) {
                    questionScore -= data.session.quiz.clientData.currentQuestion.hintCost;
                }

                data.session.quiz.serverData.score += questionScore;
            }
            else {
                data.clientResponse.question.correct = false;
                for (i = 0; i < answers.length; i++) {
                    if (answers[i].correct && answers[i].correct) {
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
            if (data.session.quiz.clientData.finished) {

                //Update total score in profile
                data.session.score += data.session.quiz.serverData.score;
                store = true;
            }
            else if (data.clientResponse.question.correct) {
                //store temporary score of quiz
                store = true;
            }

            if (data.clientResponse.xpProgress && data.clientResponse.xpProgress.rankChanged) {
                store = true;
                data.session.features = sessionUtils.computeFeatures(data.session);
                data.clientResponse.features = data.session.features;
            }

            if (store) {
                if (data.session.quiz.serverData.correctAnswers === data.session.quiz.clientData.totalQuestions) {
                    addXp(data, "quizFullScore");
                }

                dalDb.storeSession(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Check to save the score into the users object as well - when quiz is finished or when got a correct answer (which gives score and/or xp
        function (data, callback) {
            if (data.session.quiz.clientData.finished || (data.clientResponse.xpProgress && data.clientResponse.xpProgress.addition > 0)) {

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
            if (data.session.quiz.clientData.finished) {
                data.contestId = data.session.quiz.serverData.contestId;
                dalDb.getContest(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Check to save the quiz score into the contest object - when quiz is finished
        function (data, callback) {
            if (data.session.quiz.clientData.finished) {

                var myTeam = data.contest.users[data.session.userId].team;
                var myContestUser = data.contest.users[data.session.userId];

                //Update all leaderboards with the score achieved
                leaderboards.addScore(data.contest._id, myTeam, data.session.quiz.serverData.score, data.session.facebookUserId, data.session.name, data.session.avatar);

                myContestUser.score += data.session.quiz.serverData.score;
                myContestUser.teamScores[myTeam] += data.session.quiz.serverData.score;

                //Update:
                // 1. contest general score
                // 2. My score in this contest + lastPlayed
                // 3. My score in my teams contribution
                // 4. My team's score in this contest
                data.setData = {};
                data.setData["users." + data.session.userId + ".score"] = myContestUser.score;
                data.setData["users." + data.session.userId + ".teamScores." + myTeam] = myContestUser.teamScores[myTeam];
                data.setData["users." + data.session.userId + ".lastPlayed"] = (new Date()).getTime();
                data.setData.score = data.contest.score + data.session.quiz.serverData.score;

                // Check if need to replace the contest leader
                // Leader is the participant that has contributed max points for the contest regardless of teams)
                if (myContestUser.score > data.contest.users[data.contest.leader.userId].score) {
                    data.setData["leader.userId"] = data.session.userId;
                    data.setData["leader.avatar"] = data.session.avatar;
                    data.setData["leader.name"] = data.session.name;
                    data.clientResponse.becameContestLeader = true;
                }

                // Check if need to replace the my team's leader
                // Team leader is the participant that has contributed max points for his/her team)

                if (!data.contest.teams[myTeam].leader || myContestUser.teamScores[myTeam] > data.contest.users[data.contest.teams[myTeam].leader.userId].teamScores[myTeam]) {
                    data.setData["teams." + myTeam + ".leader.userId"] = data.session.userId;
                    data.setData["teams." + myTeam + ".leader.avatar"] = data.session.avatar;
                    data.setData["teams." + myTeam + ".leader.name"] = data.session.name;
                    data.clientResponse.becameTeamLeader = true;
                }

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
            if (data.session.quiz.clientData.finished) {

                data.clientResponse.results = {"contest": data.contest};

                contestsBusinessLogic.prepareContestForClient(data.clientResponse.results.contest, data.clientResponse.results.contest.users[data.session.userId].team, true);

                data.clientResponse.results.score = data.session.quiz.serverData.score;

                if (data.clientResponse.becameContestLeader) {
                    data.clientResponse.results.sound = random.pick(quizSounds.finish.great);
                    data.clientResponse.results.title = "BECAME_CONTEST_LEADER_TITLE";
                    data.clientResponse.results.message = "POSITIVE_SCORE_MESSAGE";
                }
                else if (data.session.quiz.serverData.correctAnswers === data.session.quiz.clientData.totalQuestions) {
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