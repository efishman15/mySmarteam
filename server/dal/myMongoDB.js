var mongoClient = require('mongodb').MongoClient;
var CONNECTION_STRING = "mongodb://localhost:27017/mySmarteam";
var exceptions = require('../utils/exceptions');
var topics = {};
var serverSubjectsPerLanguages = {};
var clientSubjectsPerLanguages = {};

module.exports.connect = function (callback) {
    mongoClient.connect(CONNECTION_STRING, function (err, db) {
        if (err) {
            var message = "Error connecting to the database";
            console.log(message);
            callback(err, message);
            return;
        }
        callback(null, new DbHelper(db));
    })
};

///Class DbHelper
function DbHelper(db) {
    this.db = db;
};

//Class Methods
DbHelper.prototype.getCollection = function (collectionName) {
    return this.db.collection(collectionName);
};

DbHelper.prototype.close = function () {
    return this.db.close();
};

module.exports.getSubjects = function (dbHelper, quizLanguage, serverSide, callback) {
    var subjects;
    if (serverSide) {
        subjects = serverSubjectsPerLanguages[quizLanguage];
    }
    else {
        subjects = clientSubjectsPerLanguages[quizLanguage];
    }

    if (subjects) {
        callback(null, dbHelper, subjects);
    }
    else {
        var subjectsCollection = dbHelper.getCollection("Subjects");
        subjectsCollection.find({
            "quizLanguage": quizLanguage
        }, {}, function (err, subjectsCursor) {
            if (err || !subjectsCursor) {
                callback(new exceptions.GeneralError(500, "Error retrieving subjects for language: " + language + " from the database"));
                return;
            }
            subjectsCursor.toArray(function (err, serverSubjects) {
                serverSubjectsPerLanguages[quizLanguage] = serverSubjects;
                var clientSubjects = [];
                for(var i=0; i<serverSubjects.length; i++) {
                    clientSubject = {};
                    clientSubject.subjectId = serverSubjects[i].subjectId;
                    clientSubject.displayNames = serverSubjects[i].displayNames;
                    clientSubjects.push(clientSubject);
                }
                clientSubjectsPerLanguages[quizLanguage] = clientSubjects;
                if (serverSide) {
                    callback(null, dbHelper, serverSubjects);
                }
                else {
                    callback(null, dbHelper, clientSubjects);
                }
            })
        })
    }
};

module.exports.getTopic = function (topicId, callback) {
    var topic = topics["" + topicId];
    if (topic) {
        callback(null, topic);
    }
    else {
        this.connect(function (err, dbHelper) {
            if (err) {
                callback(err);
                return;
            }
            var topicsCollection = dbHelper.getCollection("Topics");
            topicsCollection.findOne({
                "topicId": topicId
            }, {}, function (err, topic) {
                if (err || !topic) {
                    callback(new exceptions.GeneralError(500, "Error retrieving topic Id " + topicId + " from the database"));
                    return;
                }
                topics["" + topicId] = topic;
                dbHelper.close();
                callback(null, topic);

            })
        })
    }
};
