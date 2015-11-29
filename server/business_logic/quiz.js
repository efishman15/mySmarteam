var path = require("path");
var sessionUtils = require(path.resolve(__dirname, "../business_logic/session"));
var async = require("async");
var exceptions = require(path.resolve(__dirname, "../utils/exceptions"));
var random = require(path.resolve(__dirname, "../utils/random"));
var dalDb = require(path.resolve(__dirname, "../dal/dalDb"));
var generalUtils = require(path.resolve(__dirname, "../utils/general"));
var contestsBusinessLogic = require(path.resolve(__dirname, "../business_logic/contests"));
var dalLeaderboard = require(path.resolve(__dirname, "../dal/dalLeaderboards"));
var commonBusinessLogic = require(path.resolve(__dirname, "./common"));
var util = require("util");

//--------------------------------------------------------------------------
//Private functions
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// setQuestionDirection
//
// data: session
//--------------------------------------------------------------------------
function setQuestionDirection(data, callback) {

    if (!data.session.quiz.serverData.userQuestions) {


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
    else {
        data.session.quiz.clientData.currentQuestion.direction = generalUtils.settings.client.languages[data.session.settings.language].direction;
        callback(null, data);
    }
}

//----------------------------------------------------------------------------------------
// setPostStory
//
// determines if the given story has a higher post priority than the current story and
// replaces if necessary
//----------------------------------------------------------------------------------------
function setPostStory(data, story, objectValue) {

    var replaced = false;

    if (!data.session.quiz.serverData.share.story) {
        data.session.quiz.serverData.share.story = JSON.parse(JSON.stringify(generalUtils.settings.server.quiz.stories[story]));
        replaced = true;
    }
    else if (generalUtils.settings.server.quiz.stories[story].priority > data.session.quiz.serverData.share.story.priority) {
        //Replace the story with one with a higher priority
        data.session.quiz.serverData.share.story = JSON.parse(JSON.stringify(generalUtils.settings.server.quiz.stories[story]));
        replaced = true;
    }

    if (replaced && data.session.quiz.serverData.share.story.facebookPost && data.session.quiz.serverData.share.story.facebookPost.object && objectValue) {
        data.session.quiz.serverData.share.story.facebookPost.object.value = objectValue;
    }

    return replaced;
}

//--------------------------------------------------------------------------
//Public functions
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// start
//
// data: contestId
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

            if (!data.contest.users || !data.contest.users[data.session.userId]) {
                data.DbHelper.close();
                callback(new exceptions.ServerMessageException("SERVER_ERROR_NOT_JOINED_TO_CONTEST"));
            }
            else {
                callback(null, data);
            }
        },

        //Init quiz
        function (data, callback) {

            var quiz = {};
            quiz.clientData = {
                "currentQuestionIndex": -1, //First question will be incremented to 0
                "finished": false
            };

            quiz.serverData = {
                "contestId": data.contestId,
                "score": 0,
                "correctAnswers": 0,
                "share": {"data": {}}
            };

            if (data.contest.content.category.id === "user" && data.contest.creator.id.toString() === data.session.userId.toString()) {
                quiz.clientData.reviewMode = {"reason": "REVIEW_MODE_OWNER"};
            }
            else if (data.contest.content.category.id === "user" && data.contest.users[data.session.userId].lastPlayed) {
                //user is allowed to play a user-based questions contest that he DID NOT create - only once for real points
                //other plays - are for review only
                quiz.clientData.reviewMode = {"reason": "REVIEW_MODE_PLAY_AGAIN"};
            }

            //Number of questions (either entered by user or X random questions from the system
            if (data.contest.content.category.id !== "user") {
                quiz.clientData.totalQuestions = generalUtils.settings.client.quiz.questions.score.length;
                quiz.serverData.previousQuestions = [];
            }
            else {
                quiz.clientData.totalQuestions = data.contest.userQuestions.length;
                quiz.serverData.userQuestions = data.contest.userQuestions;
            }

            var myTeam = data.contest.users[data.session.userId].team;

            //--------------------------------------------------------------------------------------------------
            //-- prepare "background check" data for stories - to later evaludate if they happened
            //--------------------------------------------------------------------------------------------------

            //-- store the leading team
            if (data.contest.teams[0].score > data.contest.teams[1].score) {
                quiz.serverData.share.data.leadingTeam = 0;
            }
            else if (data.contest.teams[0].score < data.contest.teams[1].score) {
                quiz.serverData.share.data.leadingTeam = 1;
            }
            else {
                //Tie between the teams - take the OTHER team which I am not playing for
                //Any positive score achieved for my team will create a share story
                //"My score just made my team lead..."
                quiz.serverData.share.data.leadingTeam = 1 - myTeam;
            }

            //-- store if myTeamStartedBehind
            if (data.contest.teams[myTeam].score < data.contest.teams[1 - myTeam].score) {
                //My team is behind
                if (contestsBusinessLogic.getTeamDistancePercent(data.contest, 1 - myTeam) > generalUtils.settings.server.quiz.teamPercentDistanceForShare) {
                    quiz.serverData.share.data.myTeamStartedBehind = true;
                }
            }

            data.session.quiz = quiz;

            data.clientResponse.quiz = data.session.quiz.clientData;

            callback(null, data);

        },

        //Stores some friends above me in the leaderboard
        dalLeaderboard.getFriendsAboveMe,

        //Stores the friends above me in the quiz
        function (data, callback) {
            if (data.friendsAboveMe && data.friendsAboveMe.length > 0) {
                data.session.quiz.serverData.share.data.friendsAboveMe = data.friendsAboveMe;
            }
            callback(null, data);
        },

        //Pick a random subject from the avilable subjects in this quiz and prepare the query
        dalDb.prepareQuestionCriteria,

        //Count number of questions excluding the previous questions
        function (data, callback) {
            if (!data.session.quiz.serverData.userQuestions) {
                dalDb.getQuestionsCount(data, callback);
            }
            else {
                callback(null, data);
            }
        },

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
// data: id (answerId = 0 based), hintUsed (optional), answerUsed (optional)
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
                dalDb.closeDb(data);
                callback(new exceptions.ServerMessageException("SERVER_ERROR_SESSION_EXPIRED_DURING_QUIZ", null, 403));
                return;
            }

            var answers = data.session.quiz.serverData.currentQuestion.answers;
            if (data.id < 0 || data.id > answers.length - 1) {
                callback(new exceptions.ServerException("Invalid answer id", {"answerId": data.id}));
            }

            data.clientResponse.question.answerId = data.id;
            if (answers[data.id].correct) {
                data.clientResponse.question.correct = true;

                data.session.quiz.serverData.correctAnswers++;

                commonBusinessLogic.addXp(data, "correctAnswer");

                var questionScore;
                if (!data.session.quiz.clientData.reviewMode) {
                    questionScore = generalUtils.settings.server.quiz.questions.levels[data.session.quiz.clientData.currentQuestionIndex].score;
                    if (data.answerUsed && data.session.quiz.clientData.currentQuestion.answerCost) {
                        questionScore -= data.session.quiz.clientData.currentQuestion.answerCost;
                    }
                    else if (data.hintUsed && data.session.quiz.clientData.currentQuestion.hintCost) {
                        questionScore -= data.session.quiz.clientData.currentQuestion.hintCost;
                    }
                }
                else {
                    //In review mode - no scores
                    questionScore = 0;
                }

                data.session.quiz.serverData.score += questionScore;
            }
            else {
                data.clientResponse.question.correct = false;
                for (i = 0; i < answers.length; i++) {
                    if (answers[i].correct && answers[i].correct) {
                        data.clientResponse.question.correctAnswerId = i;
                        break;
                    }
                }
            }

            if (!data.session.quiz.clientData.reviewMode) {
                dalDb.updateQuestionStatistics(data, callback);
            }
            else {
                callback(null, data);
            }
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

            if (data.xpProgress) {

                store = true;
                data.clientResponse.xpProgress = data.xpProgress;

                if (data.xpProgress.rankChanged) {
                    data.session.features = sessionUtils.computeFeatures(data.session);
                    data.clientResponse.features = data.session.features;
                }
            }

            if (store) {
                dalDb.storeSession(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Check to save the score into the users object as well - when quiz is finished or when got a correct answer (which gives score and/or xp
        function (data, callback) {
            if (data.session.quiz.clientData.finished || (data.xpProgress && data.xpProgress.addition > 0)) {

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

            if (!data.session.quiz.clientData.finished || data.session.quiz.clientData.reviewMode) {
                callback(null, data);
                return;
            }

            var myTeam = data.contest.users[data.session.userId].team;
            var myContestUser = data.contest.users[data.session.userId];

            //PerfectScore story
            if (data.session.quiz.serverData.correctAnswers === data.session.quiz.clientData.totalQuestions) {
                commonBusinessLogic.addXp(data, "quizFullScore");
                setPostStory(data, "gotPerfectScore", data.contest.teams[myTeam].link);
            }

            //Update all leaderboards with the score achieved - don't wait for any callbacks of the leaderboard - can
            //be done fully async and continue doing other stuff
            dalLeaderboard.addScore(data.contest._id, myTeam, data.session.quiz.serverData.score, data.session.facebookUserId, data.session.name, data.session.avatar);

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
                setPostStory(data, "becameContestLeader", data.contest.leaderLink);
            }

            // Check if need to replace the my team's leader
            // Team leader is the participant that has contributed max points for his/her team)
            if (!data.contest.teams[myTeam].leader || myContestUser.teamScores[myTeam] > data.contest.users[data.contest.teams[myTeam].leader.userId].teamScores[myTeam]) {
                data.setData["teams." + myTeam + ".leader.userId"] = data.session.userId;
                data.setData["teams." + myTeam + ".leader.avatar"] = data.session.avatar;
                data.setData["teams." + myTeam + ".leader.name"] = data.session.name;
                setPostStory(data, "becameTeamLeader", data.contest.teams[myTeam].leaderLink);
            }

            //Update the team score
            data.contest.teams[data.contest.users[data.session.userId].team].score += data.session.quiz.serverData.score;
            data.setData["teams." + data.contest.users[data.session.userId].team + ".score"] = data.contest.teams[data.contest.users[data.session.userId].team].score;

            //Check if one of 2 stories happened:
            // 1. My team started leading
            // 2. My team is very close to lead
            if (data.session.quiz.serverData.share.data.myTeamStartedBehind) {
                if (data.contest.teams[myTeam].score > data.contest.teams[1 - myTeam].score) {
                    setPostStory(data, "madeMyTeamLead", data.contest.teams[myTeam].link);
                }
                else if (data.contest.teams[myTeam].score < data.contest.teams[1 - myTeam].score &&
                    contestsBusinessLogic.getTeamDistancePercent(data.contest, 1 - myTeam) < generalUtils.settings.server.quiz.teamPercentDistanceForShare) {
                    setPostStory(data, "myTeamIsCloseToLead", data.contest.teams[myTeam].link);
                }
            }

            if (
                //Call the leaderboard to check passed friends only if there is no story to post up until now
            //Or the "passed friends" story is a "better" story in terms of priority
            data.session.quiz.serverData.share.data.friendsAboveMe &&
            (
                !data.session.quiz.serverData.share.story ||
                data.session.quiz.serverData.share.story.priority < generalUtils.settings.server.quiz.stories.passedFriendInLeaderboard.priority
            )
            ) {
                data.friendsAboveMe = data.session.quiz.serverData.share.data.friendsAboveMe;
                dalLeaderboard.getPassedFriends(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Check the passedFriends story and save the contest
        function (data, callback) {

            if (!data.session.quiz.clientData.finished || data.session.quiz.clientData.reviewMode) {
                dalDb.closeDb(data);
                callback(null, data);
                return;
            }

            //Common data to be replaced in all potential messages
            data.session.quiz.serverData.share.data.clientData = {
                "score": data.session.quiz.serverData.score,
                "team": data.contest.teams[data.contest.users[data.session.userId].team].name
            }

            if (data.passedFriends && data.passedFriends.length > 0) {
                data.session.quiz.serverData.share.data.clientData.friend = data.passedFriends[0].name;
                var replaced = setPostStory(data, "passedFriendInLeaderboard", util.format(generalUtils.settings.server.facebook.userOpenGraphProfileUrl, data.passedFriends[0].id, data.session.settings.language));
                if (replaced) {
                    data.session.quiz.serverData.share.story.facebookPost.dialogImage.url = util.format(data.session.quiz.serverData.share.story.facebookPost.dialogImage.url, data.passedFriends[0].id, data.session.quiz.serverData.share.story.facebookPost.dialogImage.width, data.session.quiz.serverData.share.story.facebookPost.dialogImage.height);
                }
            }

            if (data.session.quiz.serverData.score > 0) {
                setPostStory(data, "gotScore");
            }
            else {
                setPostStory(data, "gotZeroScore");
            }

            data.closeConnection = true;

            dalDb.setContest(data, callback);
        },

        //Set contest result fields (required for client only),
        //AFTER contest has been saved to db
        function (data, callback) {
            if (data.session.quiz.clientData.finished) {

                if (data.session.quiz.clientData.reviewMode) {

                    if (data.session.quiz.serverData.correctAnswers === data.session.quiz.clientData.totalQuestions) {
                        setPostStory(data, "reviewPerfectScore");
                        data.session.quiz.serverData.share.data.clientData = {
                            "correct": data.session.quiz.serverData.correctAnswers,
                            "questions": data.session.quiz.clientData.totalQuestions
                        };
                    }
                    else if (data.session.quiz.serverData.correctAnswers > 0) {
                        setPostStory(data, "reviewGotScore");
                        data.session.quiz.serverData.share.data.clientData = {
                            "correct": data.session.quiz.serverData.correctAnswers,
                            "questions": data.session.quiz.clientData.totalQuestions
                        };
                    }
                    else {
                        setPostStory(data, "reviewZeroScore");
                    }
                }

                data.clientResponse.results = {"contest": data.contest, "data": {}};

                contestsBusinessLogic.prepareContestForClient(data.clientResponse.results.contest, data.session);

                data.clientResponse.results.data.score = data.session.quiz.serverData.score;

                data.clientResponse.results.data.sound = random.pick(generalUtils.settings.server.quiz.sounds.finish[data.session.quiz.serverData.share.story.soundGroup]);
                data.clientResponse.results.data.clientKey = data.session.quiz.serverData.share.story.clientKey;
                data.clientResponse.results.data.clientValues = data.session.quiz.serverData.share.data.clientData;
                data.clientResponse.results.data.animation = random.pick(generalUtils.settings.server.quiz.animations);

                if (data.session.quiz.serverData.share.story.facebookPost) {
                    data.clientResponse.results.data.facebookPost = data.session.quiz.serverData.share.story.facebookPost;
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
        function (data, callback) {
            if (!data.session.quiz.serverData.userQuestions) {
                dalDb.getQuestionsCount(data, callback);
            }
            else {
                callback(null, data);
            }
        },

        //Get the next question for the quiz
        dalDb.getNextQuestion,

        //Sets the direction of the question
        setQuestionDirection,

        //Pick animatoin and store the session with the quiz in the db
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
// setQuestionByAdmin
//
// data: question (including _id, text, answers)
//--------------------------------------------------------------------------
module.exports.setQuestionByAdmin = function (req, res, next) {

    var data = req.body;

    if (!data.question ||
        !data.question._id ||
        !data.question.text ||
        !data.question.answers |
        data.question.answers.length < 4) {
        exceptions.ServerResponseException(res, "question required data is not supplied", data, "warn", 424);
        return;
    }

    var token = req.headers.authorization;

    var operations = [

        //getSession
        function (callback) {
            data.token = token;
            sessionUtils.getSession(data, callback);
        },

        //Count number of questions excluding the previous questions
        function (data, callback) {
            if (!data.session.isAdmin) {
                dalDb.closeDb(data);
                callback(new exceptions.ServerMessageException("SERVER_ERROR_SESSION_EXPIRED_DURING_QUIZ", null, 403));
                return;
            }

            data.questionId = data.question._id;
            data.setData = {};
            data.setData.text = data.question.text;
            for (j = 0; j < data.question.answers.length; j++) {
                data.setData["answers." + j + ".text"] = data.question.answers[j];
            }

            data.closeConnection = true;
            dalDb.setQuestion(data, callback);
        }
    ];

    async.waterfall(operations, function (err, data) {
        if (!err) {
            res.send(200, "OK");
        }
        else {
            res.send(err.httpStatus, err);
        }
    })
};