var sessionUtils = require("../business_logic/session");
var async = require("async");
var exceptions = require("../utils/exceptions");
var random = require("../utils/random");
var dalDb = require("../dal/dalDb");
var generalUtils = require("../utils/general");
var contestsBusinessLogic = require("../business_logic/contests");
var dalLeaderboard = require("../dal/dalLeaderboards");
var commonBusinessLogic = require("./common");
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
                "correctAnswers": 0,
                "share": {"data": {}}
            };

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
                dalDb.closeDb(data);
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

                commonBusinessLogic.addXp(data, "correctAnswer");

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

            if (!data.session.quiz.clientData.finished) {
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

            if (!data.session.quiz.clientData.finished) {
                dalDb.closeDb(data);
                callback(null, data);
                return;
            }

            //Common data to be replaced in all potential messages
            data.session.quiz.serverData.share.data.clientData = {
                "score" : data.session.quiz.serverData.score,
                "team" : data.contest.teams[data.contest.users[data.session.userId].team].name
            }

            if (data.passedFriends && data.passedFriends.length > 0) {
                data.session.quiz.serverData.share.data.clientData.friend = data.passedFriends[0].name;
                var replaced = setPostStory(data, "passedFriendInLeaderboard", util.format(generalUtils.settings.server.facebook.userOpenGraphProfileUrl, data.passedFriends[0].id, data.session.settings.language));
                if (replaced) {
                    data.session.quiz.serverData.share.story.facebookPost.dialogImage.url = util.format(data.session.quiz.serverData.share.story.facebookPost.dialogImage.url,data.passedFriends[0].id, data.session.quiz.serverData.share.story.facebookPost.dialogImage.width, data.session.quiz.serverData.share.story.facebookPost.dialogImage.height);
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
        dalDb.getQuestionsCount,

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