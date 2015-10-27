var CONNECTION_STRING = "mongodb://localhost:27017/whoSmarter";

var mongoClient = require("mongodb").MongoClient;
var uuid = require('node-uuid');
var exceptions = require("../utils/exceptions");
var ObjectId = require("mongodb").ObjectID;
var random = require('../utils/random');
var generalUtils = require('../utils/general');
var mathjs = require("mathjs");

//---------------------------------------------------------------------
// Cache variables
//---------------------------------------------------------------------
var topics = {};

//---------------------------------------------------------------------
// Class DbHelper
//---------------------------------------------------------------------
function DbHelper(db) {
    this.db = db;
}

//Class Methods
DbHelper.prototype.getCollection = function (collectionName) {
    return this.db.collection(collectionName);
};

DbHelper.prototype.close = function () {
    return this.db.close();
};

//---------------------------------------------------------------------
// private methods
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// checkToCloseDb
//---------------------------------------------------------------------
function checkToCloseDb(data) {
    if (data.closeConnection && data.closeConnection) {
        closeDb(data);
    }
}

//------------------------------------------------------------------------------------------------
// register
//
// Register the new user
//
// data:
// -----
// input: DbHelper, user (contains thirdParty (id, accessToken), name, avatar, geoInfo, settings
// output: user
//------------------------------------------------------------------------------------------------
function register(data, callback) {
    var usersCollection = data.DbHelper.getCollection("Users");

    var now = (new Date()).getTime();

    var avatar = data.user.avatar;

    data.user.settings.sound = true;
    var newUser = {
        "facebookUserId": data.user.thirdParty.id,
        "facebookAccessToken": data.user.thirdParty.accessToken,
        "name": data.user.name,
        "email": data.user.email,  //keep sync with Facebook changes - might be null if user removed email permission
        "geoInfo": data.user.geoInfo,
        "ageRange": data.user.ageRange,
        "settings": data.user.settings,
        "score": 0,
        "xp": 0,
        "rank": 1,
        "createdAt": now,
        "lastLogin": now
    };

    usersCollection.insert(newUser
        , {}, function (err, insertResult) {
            if (err) {

                closeDb(data);

                callback(new exceptions.ServerException("Error inserting new user", {
                    "user": newUser,
                    "dbError": err
                }, "error"));
                return;
            }

            data.user = newUser;
            data.user.justRegistered = true; //does not need to be in db - just returned back to the client

            //restore avatar - computed field
            data.user.avatar = avatar;

            checkToCloseDb(data);

            callback(null, data);
        });
}

//---------------------------------------------------------------------
// closeDb
//
// Connects to the database
//
// data:
// -----
// input: DbHelper
// output: <NA>
//---------------------------------------------------------------------
module.exports.closeDb = closeDb;
function closeDb(data) {
    data.DbHelper.close();
    delete data.DbHelper;
}

//---------------------------------------------------------------------
// Connect
//
// Connects to the database
//
// data:
// -----
// input: <NA>
// output: DbHelper
//---------------------------------------------------------------------
module.exports.connect = connect;
function connect(callback) {
    mongoClient.connect(CONNECTION_STRING, function (err, db) {
        if (err) {
            callback(new exceptions.ServerException("Error connecting to the database", {"dbError": err}, "error"));
            return;
        }

        callback(null, {"DbHelper": new DbHelper(db)});
    })
}

//---------------------------------------------------------------------
// public methods
//---------------------------------------------------------------------

//------------------------------------------------------------------------------------------------
// loadSettings
//
// loads settings object from db
//------------------------------------------------------------------------------------------------
module.exports.loadSettings = loadSettings;
function loadSettings(callback) {

    connect(function (err, data) {
        var settingsCollection = data.DbHelper.getCollection("Settings");
        settingsCollection.findOne({}, {}, function (err, settings) {
            if (err || !settings) {

                closeDb(data);

                callback(new exceptions.ServerException("Error finding contest", {
                    "data": data,
                    "dbError": err
                }, "error"));

                return;
            }

            closeDb(data);

            data.settings = settings;

            callback(null, data);
        })
    })
};

//---------------------------------------------------------------------
// getTopic
//
// Lazy load from DB first time (for each topicId).
// Then, retrieved from memory cache - managed as has by topic Id
// data:
// -----
// input: topicId
// output: topic
//---------------------------------------------------------------------
module.exports.getTopic = function (data, callback) {
    var topic = topics["" + data.topicId];
    if (topic) {
        data.topic = topic;
        callback(null, data);
    }
    else {
        connect(function (err, connectData) {
            var topicsCollection = connectData.DbHelper.getCollection("Topics");
            topicsCollection.findOne({
                "topicId": data.topicId
            }, {}, function (err, topic) {
                if (err || !topic) {

                    closeDb(connectData);

                    callback(new exceptions.ServerException("Error retrieving topic by id", {
                        "topicId": data.topicId,
                        "dbError": err
                    }, "error"));
                    return;
                }
                topics["" + data.topicId] = topic;

                data.topic = topic;
                callback(null, data);
            })
        })
    }
};

//---------------------------------------------------------------------
// retrieveSession
//
// Retrieves a session from the db based on token
//
// data:
// -----
// input: DbHelper (optional), token
// output: session
//---------------------------------------------------------------------
module.exports.retrieveSession = retrieveSession;
function retrieveSession(data, callback) {

    var criteria;
    if (data.token) {
        criteria = {"userToken": data.token}
    }
    else if (data.userId) {
        criteria = {"userId": ObjectId(data.userId)}
    }
    else if (data.facebookUserId) {
        criteria = {"facebookUserId": data.facebookUserId}
    }
    else {
        callback(new exceptions.ServerException("Error retrieving session - no session identifier was supplied", null, "info", 401));
        return;
    }

    //If no connection open - call recursively to this function from within the "connect' block
    if (!data.DbHelper) {
        connect(function (err, connectData) {

            data.closeConnection = true; //Indicates to close the connection after the action
            data.DbHelper = connectData.DbHelper;
            retrieveSession(data, callback);
        });
        return;
    }

    var sessionsCollection = data.DbHelper.getCollection("Sessions");

    sessionsCollection.findOne(
        criteria, {},
        function (err, session) {
            if (!data.sessionOptional && (err || !session)) {

                closeDb(data);

                //Serverity "low" does not exist - thus skipping writing to logs and console
                callback(new exceptions.ServerException("Error retrieving session - session expired", {"sessionId": data.token}, "low", 401));
                return;
            }

            data.session = session;

            checkToCloseDb(data);

            callback(null, data);
        }
    )
}

//---------------------------------------------------------------------
// storeSession
//
// Stores a session back to db
//
// data:
// -----
// input: DbHelper, session
// output: <NA>
//---------------------------------------------------------------------
module.exports.storeSession = function (data, callback) {

    data.session.expires = new Date((new Date()).getTime() + generalUtils.settings.server.db.sessionExpirationMilliseconds)
    var sessionsCollection = data.DbHelper.getCollection("Sessions");
    sessionsCollection.update(
        {
            "_id": data.session._id
        },
        data.session,
        function (err, updated) {
            if (err) {

                closeDb(data);

                callback(new exceptions.ServerException("Error storing session expired - session expired", {"sessionId": data.session._id}, "info", 401));
                return;
            }

            checkToCloseDb(data);

            callback(null, data);
        }
    )
};

//---------------------------------------------------------------------
// setUser
//
// Saves specific data into the user's object in db
//
// data:
// -----
// input: DbHelper, session, setData (properties and their values to set)
// output: <NA>
//---------------------------------------------------------------------
module.exports.setUser = function (data, callback) {

    if (!data.setData && !data.unsetData) {
        callback(new exceptions.ServerException("Cannot updating user, either setData or unsetData must be supplied", {
            "setUserWhereClause": data.setUserWhereClause,
            "dbError": err
        }, "error"));
    }

    var usersCollection = data.DbHelper.getCollection('Users');

    if (!data.setUserWhereClause) {
        data.setUserWhereClause = {"_id": ObjectId(data.session.userId)};
    }

    var updateClause = {};
    if (data.setData) {
        updateClause = {$set: data.setData};
    }
    if (data.unsetData) {
        updateClause = {$unset: data.unsetData};
    }

    usersCollection.updateOne(data.setUserWhereClause, updateClause,
        function (err, results) {

            if (err || results.nModified < 1) {

                closeDb(data);

                callback(new exceptions.ServerException("Error updating user", {
                    "setUserWhereClause": data.setUserWhereClause,
                    "setData": data.setData,
                    "unsetData": data.unsetData,
                    "dbError": err
                }, "error"));

                return;
            }

            checkToCloseDb(data);

            callback(null, data);
        });
};

//---------------------------------------------------------------------
// facebookLogin
//
// Validates that the facebookUserId exists, and updates the lastLogin.
// If user does not exist - register the new facebook user
//
// data:
// -----
// input: DbHelper, user (contains thirdParty.id, thirdParty.accessToken), avatar
// output: user
//---------------------------------------------------------------------
module.exports.facebookLogin = function (data, callback) {

    var usersCollection = data.DbHelper.getCollection('Users');

    //Save avatar which is a computed field
    //The findAndModify will bring a "fresh" user object from db
    //Put the avatar back later on this fresh object
    var avatar = data.user.avatar;

    var thirdParty = data.user.thirdParty;
    var clientInfo = data.user.clientInfo;

    var now = (new Date()).getTime();

    usersCollection.findOne({"facebookUserId": data.user.thirdParty.id}, {}, function (err, user) {
            if (err || !user) {
                register(data, callback);
                return;
            }

            var dailyXp = 0;
            var prevLogin = new Date(user.lastLogin);

            var today = new Date();
            var now = today.getTime();

            if (prevLogin.getUTCDay() != today.getUTCDay() ||
                prevLogin.getUTCMonth() != today.getUTCMonth() ||
                prevLogin.getUTCFullYear() != today.getUTCFullYear()) {

                var xpProgress = new generalUtils.XpProgress(user.xp, user.rank);
                xpProgress.addXp(user, "login");
            }

            var setObject = {
                "$set": {
                    "lastLogin": now,
                    "facebookAccessToken": data.user.thirdParty.accessToken,
                    "name": data.user.name,  //keep sync with Facebook changes
                    "email": data.user.email,  //keep sync with Facebook changes - might be null if user removed email permission
                    "ageRange": data.user.ageRange, //keep sync with Facebook changes
                    "xp": user.xp,
                    "rank": user.rank,
                    "friends": thirdParty.friends
                }
            };


            usersCollection.updateOne({"_id": user._id}, setObject
                , function (err, results) {

                    if (err || results.nModified < 1) {

                        closeDb(data);

                        callback(new exceptions.ServerException("Error updating user during login", {
                            "user": user
                        }, "error"));

                        return;
                    }

                    //Update all those fields also locally as previouselly they were only updated in the db
                    user.lastLogin = now;
                    user.name = data.user.name;
                    user.email = data.user.email;
                    user.ageRange = data.user.ageRange;

                    data.user = user;

                    //restore the avatar back
                    data.user.avatar = avatar;

                    if (thirdParty) {
                        data.user.thirdParty = thirdParty;
                    }

                    if (clientInfo) {
                        data.user.clientInfo = clientInfo;
                    }

                    checkToCloseDb(data);

                    callback(null, data);
                });
        }
    );
};

//---------------------------------------------------------------------
// createOrUpdateSession
//
// Creates a new session for a user,
// or updates and existing one (extending the session)
//
//
// data:
// -----
// input: DbHelper, user
// output: <NA>
//---------------------------------------------------------------------
module.exports.createOrUpdateSession = function (data, callback) {

    var userToken = uuid.v1();
    var sessionsCollection = data.DbHelper.getCollection('Sessions');

    var now = new Date();
    var nowEpoch = now.getTime();

    var setObject = {
        "userId": ObjectId(data.user._id),
        "facebookUserId": data.user.facebookUserId,
        "friends" : data.user.thirdParty.friends,
        "isAdmin": data.user.isAdmin,
        "facebookAccessToken": data.user.facebookAccessToken,
        "name": data.user.name,
        "ageRange": data.user.ageRange,
        "avatar": data.user.avatar,
        "created": nowEpoch,
        "expires": new Date(nowEpoch + generalUtils.settings.server.db.sessionExpirationMilliseconds), //must be without getTime() since db internally removes by TTL - and ttl works only when it is actual date and not epoch
        "userToken": userToken,
        "settings": data.user.settings,
        "score": data.user.score,
        "xp": data.user.xp,
        "rank": data.user.rank,
        "features": data.features,
        "clientInfo": data.user.clientInfo,
    };

    if (data.user.justRegistered) {
        setObject.justRegistered = true;
    }

    if (data.user.gcmRegistrationId) {
        setObject.gcmRegistrationId = data.user.gcmRegistrationId
    }

    sessionsCollection.findAndModify({"userId": ObjectId(data.user._id)}, {},
        {
            $set: setObject,
        }, {upsert: true, new: true}, function (err, session) {

            if (err) {

                closeDb(data);

                callback(new exceptions.ServerException("Error finding/creating session", {
                    "userId": user._id,
                    "dbError": err
                }, "error"));
                return;
            }

            data.session = session.value;
            if (!data.user.gcmRegistrationId) {
                data.session.noGcmRegistration = true
            }

            //Write to session history
            var sessionsHistoryCollection = data.DbHelper.getCollection('SessionHistory');
            var sessionHistoryRecord = JSON.parse(JSON.stringify(data.session));
            sessionHistoryRecord.sessionId = sessionHistoryRecord._id;
            delete sessionHistoryRecord._id;

            sessionsHistoryCollection.insert(sessionHistoryRecord
                , {}, function (sessionHistoryError, insertResult) {
                    if (sessionHistoryError) {

                        closeDb(data);

                        callback(new exceptions.ServerException("Error inserting session history record", {
                            "session": data.session,
                            "dbError": sessionHistoryError
                        }, "error"));
                        return;
                    }

                    if (session.lastErrorObject.upserted) {

                        var closeConnection = data.closeConnection;

                        data.closeConnection = false;

                        //Do not close connection on an inner logAction
                        data.logAction = {
                            "action": "login",
                            "userId": data.session.userId,
                            "sessionId": data.session.userToken
                        };

                        logAction(data, function (err, data) {

                            if (err) {
                                closeDb(data);

                                callback(new exceptions.ServerException("Error inserting log record", {
                                    "action": data.action,
                                    "session": data.session,
                                    "dbError": err
                                }, "error"));
                                return;
                            }

                            data.closeConnection = closeConnection;

                            checkToCloseDb(data);

                            callback(null, data);
                        })
                    }
                    else {
                        checkToCloseDb(data);
                        callback(null, data);
                    }
                });
        })
};


//---------------------------------------------------------------------
// logout
// removes the user's session (if exist)
//
// data:
// -----
// input: DbHelper, token
// output: <NA>
//---------------------------------------------------------------------
module.exports.logout = function (data, callback) {
    var sessionsCollection = data.DbHelper.getCollection("Sessions");
    sessionsCollection.findOne({
        "userToken": data.token
    }, {}, function (err, session) {
        if (err || !session) {

            closeDb(data);

            callback(new exceptions.ServerException("Error logging out from session - session expired", {
                "userId": data.token,
                "dbError": err
            }, "info"));
            return;
        }

        //Actual logout - remove the session
        sessionsCollection.remove(
            {
                "userToken": data.token
            }
            , {w: 1, single: true},
            function (err, numberOfRemovedDocs) {
                if (err || numberOfRemovedDocs.ok == 0) {
                    //Session does not exist - stop the call chain

                    closeDb(data);

                    callback(new exceptions.ServerException("Error logging out from session - session expired", {
                        "userId": data.token,
                        "dbError": err
                    }, "info"));
                    return;
                }

                checkToCloseDb(data);

                callback(null, data);
            }
        );
    })
};

//---------------------------------------------------------------------
// logAction
// logs the action to the db (for statistics)
//
// data:
// -----
// input: DbHelper, session, action, actionData (optional)
// output: <NA>
//---------------------------------------------------------------------
module.exports.logAction = logAction;
function logAction(data, callback) {

    var logCollection = data.DbHelper.getCollection("Log");

    data.logAction.date = (new Date()).getTime();

    logCollection.insert(data.logAction
        , {}, function (err, insertResult) {
            if (err) {

                closeDb(data);

                callback(new exceptions.ServerException("Error inserting record to log", {
                    "action": data.logAction,
                    "dbError": err
                }, "error"));
                return;
            }

            checkToCloseDb(data);

            callback(null, data);
        })
};

//---------------------------------------------------------------------
// prepareQuestionCriteria
//
// data:
// -----
// input: DbHelper, session
// output: questionCriteria
//---------------------------------------------------------------------
module.exports.prepareQuestionCriteria = prepareQuestionCriteria;
function prepareQuestionCriteria(data, callback) {

    data.session.quiz.clientData.currentQuestionIndex++;

    var questionLevel = generalUtils.settings.server.quiz.questions.levels[data.session.quiz.clientData.currentQuestionIndex];

    var questionCriteria = {
        "$and": [
            {"_id": {"$nin": data.session.quiz.serverData.previousQuestions}},
            {"topicId": {"$in": generalUtils.settings.server.triviaTopicsPerLanguage[data.session.settings.language]}},
            {
                "$or": [
                    {"correctAnswers": 0, "wrongAnswers": 0},
                    {
                        "$and": [
                            {"correctRatio": {$gte: questionLevel.minCorrectRatio}},
                            {"correctRatio": {$lt: questionLevel.maxCorrectRatio}}
                        ]
                    }]
            }
        ]
    };

    //Filter by age if available
    if (data.session.ageRange) {
        if (data.session.ageRange.min) {
            questionCriteria["$and"].push({"minAge": {$lte: data.session.ageRange.min}});
        }

        if (data.session.ageRange.max) {
            questionCriteria["$and"].push({"maxAge": {$gte: data.session.ageRange.max}});
        }
    }

    data.questionCriteria = questionCriteria;

    callback(null, data);
};

//---------------------------------------------------------------------
// getQuestionsCount
//
// Count questions collection in the prepared question criteria
//
// data:
// -----
// input: DbHelper, session, questionCriteria
// output: questionsCount
//---------------------------------------------------------------------
module.exports.getQuestionsCount = getQuestionsCount;
function getQuestionsCount(data, callback) {
    var questionsCollection = data.DbHelper.getCollection("Questions");
    questionsCollection.count(data.questionCriteria, function (err, count) {
        if (err || count === 0) {
            callback(new exceptions.ServerException("Error retrieving number of questions from the database", {
                "count": count,
                "questionCriteria" : data.questionCriteria,
                "dbError": err
            }, "error"));
            return;
        }

        data.questionsCount = count;

        callback(null, data);
    })
};

//---------------------------------------------------------------------
// getNextQuestion
//
// Get the next question
//
// data:
// -----
// input: DbHelper, session, questionCriteria, questionsCount
// output: questionsCount
//---------------------------------------------------------------------
module.exports.getNextQuestion = getNextQuestion;
function getNextQuestion(data, callback) {
    var skip = random.rnd(0, data.questionsCount - 1);
    var questionsCollection = data.DbHelper.getCollection("Questions");
    questionsCollection.findOne(data.questionCriteria, {skip: skip}, function (err, question) {
        if (err || !question) {
            callback(new exceptions.ServerException("Error retrieving next question from database", {
                "questionsCount": data.questionsCount,
                "questionCriteria" : data.questionCriteria,
                "skip" : skip,
                "dbError": err
            }, "error"));
            return;
        }

        if (data.session.quiz.clientData.totalQuestions === (data.session.quiz.clientData.currentQuestionIndex + 1)) {
            data.session.quiz.clientData.finished = true;
        }

        //Session is dynamic - perform some evals...
        if (question.vars) {

            //define the vars as "global" vars so they can be referenced by further evals
            for (var key in question.vars) {
                global[key] = eval(question.vars[key]);
            }

            //The question.text can include expressions like these: {{xp1}} {{xp2}} which need to be "evaled"
            question.text = question.text.replace(/\{\{(.*?)\}\}/g, function (match) {
                return eval(match.substring(2, match.length - 2));
            });

            //The answer.answer can include expressions like these: {{xp1}} {{xp2}} which need to be "evaled"
            question.answers.forEach(function (element, index, array) {
                element["text"] = element["text"].replace(/\{\{(.*?)\}\}/g, function (match) {
                    return eval(match.substring(2, match.length - 2));
                });
            })

            //delete global vars used for the evaluation
            for (var key in question.vars) {
                delete global[key];
            }
        }

        //Shuffle the answers
        question.answers = random.shuffle(question.answers);

        data.session.quiz.serverData.currentQuestion = question;

        data.session.quiz.clientData.currentQuestion = {
            "text": question.text,
            "answers": []
        };

        if (question.wikipediaHint) {
            data.session.quiz.clientData.currentQuestion.wikipediaHint = question.wikipediaHint;
            data.session.quiz.clientData.currentQuestion.hintCost = generalUtils.settings.server.quiz.questions.levels[data.session.quiz.clientData.currentQuestionIndex].score * generalUtils.settings.server.quiz.hintCost;
        }

        if (question.wikipediaAnswer) {
            data.session.quiz.clientData.currentQuestion.wikipediaAnswer = question.wikipediaAnswer;
            data.session.quiz.clientData.currentQuestion.answerCost = generalUtils.settings.server.quiz.questions.levels[data.session.quiz.clientData.currentQuestionIndex].score * generalUtils.settings.server.quiz.answerCost;
        }

        if (question.correctAnswers > 0 || question.wrongAnswers > 0) {
            data.session.quiz.clientData.currentQuestion.correctRatio = question.correctRatio;
        }

        for (var i = 0; i < question.answers.length; i++) {
            data.session.quiz.clientData.currentQuestion.answers.push({
                "id": i + 1,
                "text": question.answers[i].text
            })
        }

        //Add this question id to the list of questions already asked during this quiz
        data.session.quiz.serverData.previousQuestions.push(question._id);

        callback(null, data);
    })
};

//------------------------------------------------------------------------------------------------
// addContest
//
// add a new Contest
//
// data:
// -----
// input: DbHelper, session, contest
// output: contest (including the new _id got from db)
//------------------------------------------------------------------------------------------------
module.exports.addContest = addContest;
function addContest(data, callback) {
    var contestsCollection = data.DbHelper.getCollection("Contests");

    contestsCollection.insert(data.contest
        , {}, function (err, insertResult) {

            if (err) {

                closeDb(data);

                callback(new exceptions.ServerException("Error adding contest", {
                    "data": data,
                    "dbError": err
                }, "error"));
                return;
            }

            callback(null, data);
        });
}

//------------------------------------------------------------------------------------------------
// setContest
//
// updates the Contest
//
// data:
// -----
// input: DbHelper, session, contest, checkOwner
// output: contest (most updated object in db)
//------------------------------------------------------------------------------------------------
module.exports.setContest = setContest;
function setContest(data, callback) {
    var contestsCollection = data.DbHelper.getCollection('Contests');

    var whereClause = {"_id" : ObjectId(data.contest._id)};

    //Only contest owners or admins can update the contest
    if (data.checkOwner && !data.session.isAdmin) {
        whereClause.userIdCreated = ObjectId(data.session.userId);
    }

    contestsCollection.findAndModify(whereClause, {},
        {
            $set: data.setData
        }, {w: 1, new: true}, function (err, contest) {

            if (err || !contest || !contest.value) {
                closeDb(data);

                callback(new exceptions.ServerException("Error setting contest", {
                    "whereClause" : whereClause,
                    "session" : data.session,
                    "setData": data.setData,
                    "contestId": data.contestId,
                    "dbError": err
                }, "error"));
                return;
            }

            data.contest = contest.value; //refreshes the latest state object from db

            checkToCloseDb(data);

            callback(null, data);
        });
}

//------------------------------------------------------------------------------------------------
// removeContest
//
// Remove the contest
//
// data:
// -----
// input: DbHelper, session, contest
// output: <NA>
//------------------------------------------------------------------------------------------------
module.exports.removeContest = removeContest;
function removeContest(data, callback) {

    var contestsCollection = data.DbHelper.getCollection('Contests');
    contestsCollection.remove(
        {
            "_id": ObjectId(data.contestId)
        }
        , {w: 1, single: true},
        function (err, numberOfRemovedDocs) {
            if (err || numberOfRemovedDocs.ok == 0) {

                //Contest does not exist - stop the call chain
                closeDb(data);

                callback(new exceptions.ServerException("Error removing contest", {
                    "data": data,
                    "dbError": err
                }, "error"));
                return;
            }

            checkToCloseDb(data);

            callback(null, data);
        });
}

//------------------------------------------------------------------------------------------------
// getContest
//
// Get a contest by id
// //
// data:
// -----
// input: DbHelper, session, contestId
// output: <NA>
//------------------------------------------------------------------------------------------------
module.exports.getContest = getContest;
function getContest(data, callback) {

    var contestsCollection = data.DbHelper.getCollection('Contests');
    contestsCollection.findOne({
        "_id": ObjectId(data.contestId)
    }, {}, function (err, contest) {
        if (err || !contest) {

            closeDb(data);

            callback(new exceptions.ServerException("Error finding contest", {
                "data": data,
                "dbError": err
            }, "error"));

            return;
        }

        data.contest = contest;

        callback(null, data);
    })
}

//---------------------------------------------------------------------
// prepareContestsQuery
//
// data:
// -----
// input: DbHelper, session, clientContestsCount, tab
// output: contestsCriteria
//---------------------------------------------------------------------
module.exports.prepareContestsQuery = prepareContestsQuery;
function prepareContestsQuery(data, callback) {

    var contestsCriteria = {"language": data.session.settings.language};
    var contestsOrder = [];

    var now = (new Date()).getTime();

    switch (data.tab) {
        case "mine":
            contestsCriteria.endDate = {$gte: now}; //not finished yet
            contestsCriteria["users." + data.session.userId] = {$exists: true};
            contestsOrder.push(["participants", "desc"]);  //order by participants descending
            break;

        case "running":
            contestsCriteria.endDate = {$gte: now}; //not finished yet
            contestsOrder.push(["participants", "desc"]);  //order by participants descending
            break;

        case "recentlyFinished":
            contestsCriteria.endDate = {$lt: now, $gte: now - (generalUtils.settings.server.contestList.recentlyFinishedDays * 24 * 60 * 60 * 1000)}; //finished in the past 2 days
            contestsOrder.push(["endDate", "desc"]);  //order by participants descending
            break;

        default:
            closeDb(data);
            callback(new exceptions.ServerException("Error getting contests - tab invalid or not supplied", {
                "data": data,
                "dbError": err
            }, "error"));
            return;
    }

    data.contestsCriteria = contestsCriteria;
    data.contestsOrder = contestsOrder;

    callback(null, data);
}

//---------------------------------------------------------------------
// getContestsCount
//
// Count contests based on the prepared criteria
//
// data:
// -----
// input: DbHelper, session, contestCriteria
// output: contestsCount
//---------------------------------------------------------------------
module.exports.getContestsCount = getContestsCount;
function getContestsCount(data, callback) {
    var contestsCollection = data.DbHelper.getCollection("Contests");
    contestsCollection.count(data.contestsCriteria, function (err, count) {
        if (err) {
            callback(new exceptions.ServerException("Error retrieving number of contests from database", {
                "data": data,
                "dbError": err
            }, "error"));
            return;
        }

        data.contestsCount = count;

        callback(null, data);
    })
};

//------------------------------------------------------------------------------------------------
// getContests
//
// Get all contests.
//
// data:
// -----
// input: DbHelper, session, contest
// output: <NA>
//------------------------------------------------------------------------------------------------
module.exports.getContests = getContests;
function getContests(data, callback) {
    var contestsCollection = data.DbHelper.getCollection('Contests');
    contestsCollection.find(data.contestsCriteria,
        {
            skip: data.clientContestCount,
            limit: generalUtils.settings.client.contestList.pageSize,
            sort: data.contestsOrder
        },
        function (err, contestsCursor) {
            if (err || !contestsCursor) {

                callback(new exceptions.ServerException("Error retrieving contests", {
                    "data": data,
                    "dbError": err
                }, "error"));

                return;
            }
            contestsCursor.toArray(function (err, contests) {

                data.contests = contests;
                callback(null, data);
            });

        });
}

//------------------------------------------------------------------------------------------------
// updateQuestionStatistics
//
// Update questions statistics (correctAnswers, wrongAnswers, correctRatio)
//
// data:
// -----
// input: DbHelper, session, response.question.correct
// output: <NA>
//------------------------------------------------------------------------------------------------
module.exports.updateQuestionStatistics = updateQuestionStatistics;
function updateQuestionStatistics(data, callback) {

    var questionsCollection = data.DbHelper.getCollection("Questions");
    questionsCollection.findOne({
        "_id": ObjectId(data.session.quiz.serverData.currentQuestion._id)
    }, {}, function (err, question) {

        if (err || !question) {

            closeDb(data);

            callback(new exceptions.ServerException("Error finding question to update statistics", {
                "data": data,
                "dbError": err
            }, "error"));
            return;
        }

        var correctAnswers = question.correctAnswers;
        var wrongAnswers = question.wrongAnswers;
        if (data.clientResponse.question.correct) {
            correctAnswers++;
        }
        else {
            wrongAnswers++;
        }
        var correctRatio = correctAnswers / (correctAnswers + wrongAnswers);

        questionsCollection.updateOne({"_id": ObjectId(data.session.quiz.serverData.currentQuestion._id)},
            {
                $set: {"correctAnswers": correctAnswers, "wrongAnswers": wrongAnswers, "correctRatio": correctRatio}
            }, function (err, results) {

                if (err || results.nModified < 1) {

                    closeDb(data);

                    callback(new exceptions.ServerException("Error updating question statistics", {
                        "quesitonId": data.session.quiz.serverData.currentQuestion.questionId,
                        "updateResults": results,
                        "dbError": err
                    }, "error"));

                    return;
                }

                checkToCloseDb(data);

                callback(null, data);
            });

    })
}

//--------------------------------------------------------------------------------------------------------------
// insertPurchase
//
// Inserts a new purchase record - duplicates are catched and switches data.duplicatePurchase to true
//
// data:
// -----
// input: DbHelper, newPurchase
// output: possibly duplicatePurchase=true
//--------------------------------------------------------------------------------------------------------------
module.exports.insertPurchase = insertPurchase;
function insertPurchase(data, callback) {

    if (!data.DbHelper) {

        connect(function (err, connectData) {

            data.DbHelper = connectData.DbHelper;

            insertPurchase(data, callback);
        });
        return;
    }

    var purchasesCollection = data.DbHelper.getCollection("Purchases");

    data.newPurchase.created = (new Date()).getTime();

    purchasesCollection.insert(data.newPurchase
        , {}, function (err, insertResult) {
            if (err) {
                if (err.code !== 11000) {

                    closeDb(data);

                    callback(new exceptions.ServerException("Error inserting purchase record", {
                        "purchaseRecord": data.newPurchase,
                        "dbError": err
                    }, "error"));

                    return;
                }
                else {
                    data.duplicatePurchase = true;
                }
            }

            checkToCloseDb(data);

            callback(null, data);
        });
}

//--------------------------------------------------------------------------------------------------------------
// insertPurchase
//
// Inserts a new purchase record - duplicates are catched and switches data.duplicatePurchase to true
//
// data:
// -----
// input: DbHelper, contestId
// output: participants (array)
//--------------------------------------------------------------------------------------------------------------
module.exports.getContestTopParticipants = getContestTopParticipants;
function getContestTopParticipants(data, callback) {

    var contestsCollection = data.DbHelper.getCollection("Contests");

    data.newPurchase.created = (new Date()).getTime();

    purchasesCollection.insert(data.newPurchase
        , {}, function (err, insertResult) {
            if (err) {
                if (err.code !== 11000) {

                    closeDb(data);

                    callback(new exceptions.ServerException("Error inserting purchase record", {
                        "purchaseRecord": data.newPurchase,
                        "dbError": err
                    }, "error"));

                    return;
                }
                else {
                    data.duplicatePurchase = true;
                }
            }

            checkToCloseDb(data);

            callback(null, data);
        });
}
