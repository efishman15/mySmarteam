var CONNECTION_STRING = "mongodb://localhost:27017/mySmarteam";

var mongoClient = require("mongodb").MongoClient;
var uuid = require('node-uuid');
var exceptions = require("../utils/exceptions");
var ObjectId = require("mongodb").ObjectID;
var random = require('../utils/random');

//---------------------------------------------------------------------
// Cache variables
//---------------------------------------------------------------------
var topics = {};
var serverSubjectsPerLanguages = {};
var clientSubjectsPerLanguages = {};

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
// private functions
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// checkToCloseDb
//---------------------------------------------------------------------
function checkToCloseDb(data) {
    if (data.closeConnection && data.closeConnection == true) {
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

    data.user.settings.sound = true;
    var newUser = {
        "facebookUserId": data.user.thirdParty.id,
        "facebookAccessToken": data.user.thirdParty.accessToken,
        "name": data.user.name,
        "geoInfo" : data.user.geoInfo,
        "ageRange": data.user.ageRange,
        "settings": data.user.settings,
        "score" : 0,
        "createdAt": (new Date()).getTime()
    };

    usersCollection.insert(newUser
        , {}, function (err, user) {
            if (err) {

                closeDb(data);

                callback(new exceptions.ServerException("Error inserting new user", {"user" : newUser, "dbError" : err}, "error"));
                return;
            }

            data.user = newUser;

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
            callback(new exceptions.ServerException("Error connecting to the database", {"dbError" : err}, "error"));
            return;
        }

        callback(null, {"DbHelper": new DbHelper(db)});
    })
}

//---------------------------------------------------------------------
// getSubjects
//
// Lazy load from DB first time.
// Then, retrieved from memory cache - managed as has by language
//
// data:
// -----
// input: DbHelper, language, isServerSide
// output: subjects
//---------------------------------------------------------------------
module.exports.getSubjects = function (data, callback) {
    var subjects;
    if (data.isServerSide) {
        subjects = serverSubjectsPerLanguages[data.language];
    }
    else {
        subjects = clientSubjectsPerLanguages[data.language];
    }

    if (subjects) {
        data.subjects = subjects;
        callback(null, data);
    }
    else {
        var subjectsCollection = data.DbHelper.getCollection("Subjects");
        subjectsCollection.find({
            "language": data.language
        }, {}, function (err, subjectsCursor) {
            if (err || !subjectsCursor) {
                callback(new exceptions.ServerException("Error retrieving subjects for language", {"language" : data.language, "dbError" : err}, "error"));
                return;
            }
            subjectsCursor.toArray(function (err, serverSubjects) {
                serverSubjectsPerLanguages[data.language] = serverSubjects;
                var clientSubjects = [];
                for (var i = 0; i < serverSubjects.length; i++) {
                    var clientSubject = {};
                    clientSubject.subjectId = serverSubjects[i].subjectId;
                    clientSubject.displayNames = serverSubjects[i].displayNames;
                    clientSubjects.push(clientSubject);
                }
                clientSubjectsPerLanguages[data.language] = clientSubjects;
                if (data.isServerSide) {
                    data.subjects = serverSubjects
                }
                else {
                    data.subjects = clientSubjects
                }
                callback(null, data);
            })
        })
    }
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
            if (err) {
                callback(err);
                return;
            }
            var topicsCollection = connectData.DbHelper.getCollection("Topics");
            topicsCollection.findOne({
                "topicId": data.topicId
            }, {}, function (err, topic) {
                if (err || !topic) {

                    closeDb(connectData);

                    callback(new exceptions.ServerException("Error retrieving topic by id", {"topicId" : data.topicId, "dbError" : err}, "error"));
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

    //If no connection open - call recursively to this function from within the "connect' block
    if (!data.DbHelper) {
        connect(function (err, connectData) {
            if (err) {
                callback(err);
                return;
            }

            data.closeConnection = true; //Indicates to close the connection after the action
            data.DbHelper = connectData.DbHelper;
            retrieveSession(data, callback);
        });
        return;
    }

    var sessionsCollection = data.DbHelper.getCollection("Sessions");
    sessionsCollection.findOne(
        {
            "userToken": data.token
        }
        , {},
        function (err, session) {
            if (err || !session) {

                closeDb(data);

                callback(new exceptions.ServerException("Error retrieving session - session expired", {"sessionId" : data.token}, "info"), 401);
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
    var sessionsCollection = data.DbHelper.getCollection("Sessions");
    sessionsCollection.update(
        {
            "_id": data.session._id
        },
        data.session,
        function (err, updated) {
            if (err) {

                closeDb(data);

                callback(new exceptions.ServerException("Error storing session expired - session expired", {"sessionId" : data.session._id}, "info"), 401);
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
    var usersCollection = data.DbHelper.getCollection('Users');
    usersCollection.findAndModify({"_id": ObjectId(data.session.userId)}, {},
        {
            $set: data.setData
        }, {w: 1}, function (err, user) {

            if (err) {

                closeDb(data);

                callback(new exceptions.ServerException("Error updating user", {"userId" : ObjectId(data.session.userId), "dbError" : err}, "error"));

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

    usersCollection.findAndModify({"facebookUserId": data.user.thirdParty.id}, {},
        {
            $set: {
                "lastLogin": (new Date()).getTime(),
                "name": data.user.name,  //keep sync with Facebook changes
                "email": data.user.email,  //keep sync with Facebook changes - might be null if user removed email permission
                "ageRange": data.user.ageRange //keep sync with Facebook changes
            }
        }, {w: 1, new: true}, function (err, user) {

            if (err || !user.value) {
                register(data, callback);
                return;
            }

            data.user = user.value;
            callback(null, data);
        })
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
    sessionsCollection.findAndModify({"userId": ObjectId(data.user._id)}, {},
        {
            $set: {
                "userId": ObjectId(data.user._id),
                "facebookUserId": data.user.facebookUserId,
                "isAdmin": data.user.isAdmin,
                "facebookAccessToken": data.user.facebookAccessToken,
                "name": data.user.name,
                "ageRange": data.user.ageRange,
                "avatar": data.user.avatar,
                "createdAt": new Date(), //must be without getTime() since db internally removes by TTL - and ttl works only when it is actual date and not epoch
                "userToken": userToken,
                "settings": data.user.settings
            }
        }, {upsert: true, new: true}, function (err, session) {

            if (err) {

                closeDb(data);

                callback(new exceptions.ServerException("Error finding/creating session", {"userId" : user._id, "dbError" : err}, "error"));
                return;
            }

            if (session.nUpserted > 0) {
                logAction({"DbHelper": data.DbHelper, "userId": data.user._id, "action": "login"});
            }

            checkToCloseDb(data);

            data.session = session.value;

            callback(null, data);
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

            callback(new exceptions.ServerException("Error logging out from session - session expired", {"userId" : data.token, "dbError" : err}, "info"));
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

                    callback(new exceptions.ServerException("Error logging out from session - session expired", {"userId" : data.token, "dbError" : err}, "info"));
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
// input: DbHelper, userId, action, actionData (optional)
// output: <NA>
//---------------------------------------------------------------------
module.exports.logAction = logAction;
function logAction(data, callback) {

    var logCollection = data.DbHelper.getCollection("Log");

    var newAction = {
        "userId": data.userId,
        "date": (new Date()).getTime(),
        "action": data.action
    };

    if (data.actionData) {
        newAction.data = data.actionData;
    }

    logCollection.insert(newAction
        , {}, function (err, logAction) {
            if (err) {

                checkToCloseDb(data);

                callback(new exceptions.ServerException("Error inserting record to log", {"action" : newAction, "dbError" : err}, "error"));
                return;
            }

            checkToCloseDb(data);

            callback(null, data);
        })
};

//---------------------------------------------------------------------
// prepareQuestionCriteria
// removes the user's session (if exist)
//
// data:
// -----
// input: DbHelper, session
// output: questionCriteria
//---------------------------------------------------------------------
module.exports.prepareQuestionCriteria = prepareQuestionCriteria;
function prepareQuestionCriteria(data, callback) {

    var randomTopic = random.rnd(0, data.session.quiz.serverData.topics.length - 1);

    var questionCriteria = {
        "_id": {"$nin": data.session.quiz.serverData.previousQuestions},
        "topicId": data.session.quiz.serverData.topics[randomTopic]
    };

    //Filter by age if available
    if (data.session.ageRange) {
        if (data.session.ageRange.min) {
            questionCriteria.minAge = {$lte: data.session.ageRange.min}
        }

        if (data.session.ageRange.max) {
            questionCriteria.maxAge = {$gte: data.session.ageRange.max}
        }
    }

    data.questionCriteria = questionCriteria;

    callback(null, data);
};

//---------------------------------------------------------------------
// getQuestionsCount
//
// Count questions collection in the selected subject (its topics)
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
        if (err) {
            callback(new exceptions.ServerException("Error retrieving number of questions from database", {"data" : data, "dbError" : err}, "error"));
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
            callback(new exceptions.ServerException("Error retrieving next question from database", {"data" : data, "dbError" : err}, "error"));
            return;
        }

        data.session.quiz.clientData.currentQuestionIndex++;
        if (data.session.quiz.clientData.totalQuestions == data.session.quiz.clientData.currentQuestionIndex) {
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

        data.session.quiz.clientData.currentQuestion = {"text": question.text, "answers": []};
        for (var i = 0; i < question.answers.length; i++) {
            data.session.quiz.clientData.currentQuestion.answers.push({"id": i + 1, "text": question.answers[i].text})
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
        , {}, function (err, contest) {
            if (err) {

                closeDb(data);

                callback(new exceptions.ServerException("Error adding contest", {"data" : data, "dbError" : err}, "error"));
                return;
            }

            data.contest = contest

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
// input: DbHelper, session, contest
// output: contest (most updated object in db)
//------------------------------------------------------------------------------------------------
module.exports.setContest = setContest;
function setContest(data, callback) {
    var contestsCollection = data.DbHelper.getCollection('Contests');
    var contestId = ObjectId(data.contest._id);
    delete data.contest["_id"];
    contestsCollection.findAndModify({"_id": contestId}, {},
        {
            $set: data.setData
        }, {w: 1, new : true}, function (err, contest) {

            if (err) {
                closeDb(data);

                callback(new exceptions.ServerException("Error setting contest", {"data" : data, "contestId" : contestId, "dbError" : err}, "error"));
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

                callback(new exceptions.ServerException("Error removing contest", {"data" : data, "dbError" : err}, "error"));
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

            callback(new exceptions.ServerException("Error finding contest", {"data" : data, "dbError" : err}, "error"));

            return;
        }

        data.contest = contest;

        callback(null, data);
    })
}

//------------------------------------------------------------------------------------------------
// getContests
//
// Get all contests.
// TODO: retrieve by filters of tabs/paging etc...
//
// data:
// -----
// input: DbHelper, session, contest
// output: <NA>
//------------------------------------------------------------------------------------------------
module.exports.getContests = getContests;
function getContests(data, callback) {
    var contestsCollection = data.DbHelper.getCollection('Contests');
    contestsCollection.find({}, {}, function (err, contestsCursor) {
        if (err || !contestsCursor) {

            callback(new exceptions.ServerException("Error retrieving contests", {"data" : data, "dbError" : err}, "error"));

            return;
        }
        contestsCursor.toArray(function (err, contests) {

            data.contests = contests;
            callback(null, data);
        })
    })
}
