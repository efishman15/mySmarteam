// Retrieve
var session = require("../business_logic/session");
var async = require('async');
var excptions = require('../business_logic/exceptions');

module.exports.start = function (req, res, next) {
    var token = req.headers.authorization;
    var operations = [

        //Connect
        function (callback) {
            session.getSession(token, callback);
        },

        //Init quiz
        function (dbHelper, session, callback) {
            var quiz = {serverData: {previousQuestions: []}, clientData: {}};

            quiz.clientData.totalQuestions = 5;
            quiz.clientData.currentQuestionIndex = 0;

            session.quiz = quiz;

            callback(null, dbHelper, session)
        },

        //Count number of questions excluding the previous questions
        getQuestionsCount,

        //Get the next question for the quiz
        getNextQuestion,

        //Stores the session with the quiz in the db
        session.storeSession,

        //Clears the "Correct" property from each answer before sending to client
        clearCorrectProperty,

        //Close the db
        function (dbHelper, session, callback) {
            dbHelper.close();
            callback(null, session.quiz.clientData);
        }
    ];

    async.waterfall(operations, function (err, quizClientData) {
        if (!err) {
            res.send(200, quizClientData);
        }
        else {
            res.send(err.status, err);
        }
    })
};

module.exports.answer = function (req, res, next) {
    var token = req.headers.authorization;
    var answer = req.body;

    var operations = [

        //Connect
        function (callback) {
            session.getSession(token, callback);
        },

        //Check answer
        function (dbHelper, session, callback) {

            var result = {};
            var answers = session.quiz.clientData.currentQuestion.answers;
            var answerId = parseInt(answer.id, 10);
            if (answerId < 1 || answerId > answers.length) {
                callback(new excptions.GeneralError(424, "Invalid answer id: " + answer.id));
            }

            result.answerId = answerId;
            if (answers[answerId-1].correct) {
                result.correct = true;
            }
            else {
                result.correct = false;
                for(i=0; i<answers.length; i++) {
                    if (answers[i].correct && answers[i].correct == true) {
                        result.correctAnswerId = i+1;
                        break;
                    }
                }
            }

            callback(null, dbHelper, result);
        },

        //Close the db
        function (dbHelper, result, callback) {
            dbHelper.close();
            callback(null, result);
        }
    ];

    async.waterfall(operations, function (err, result) {
        if (!err) {
            res.send(200, result);
        }
        else {
            res.send(err.status, err);
        }
    })
}

module.exports.nextQuestion = function (req, res, next) {
    var token = req.headers.authorization;
    var operations = [

        //Connect
        function (callback) {
            session.getSession(token, callback);
        },

        //Count number of questions excluding the previous questions
        getQuestionsCount,

        //Get the next question for the quiz
        getNextQuestion,

        //Stores the session with the quiz in the db
        session.storeSession,

        //Clears the "Correct" property from each answer before sending to client
        clearCorrectProperty,

        //Close the db
        function (dbHelper, session, callback) {
            dbHelper.close();
            callback(null, session.quiz.clientData);
        }
    ];

    async.waterfall(operations, function (err, quizClientData) {
        if (!err) {
            res.send(200, quizClientData);
        }
        else {
            res.send(err.status, err);
        }
    })
};

//Count questions collection
function getQuestionsCount(dbHelper, session, callback) {
    var questionsCollection = dbHelper.getCollection("Questions");
    questionsCollection.count({"_id": {"$nin": session.quiz.serverData.previousQuestions}}, function (err, count) {
        if (err) {
            callback(new excptions.GeneralError(500, "Error retrieving number of questions from database"));
            return;
        }
        ;
        callback(null, dbHelper, session, count);
    })
};

//Get the next question
function getNextQuestion(dbHelper, session, count, callback) {

    console.log("Getting next question, prevQuestions: " + JSON.stringify(session.quiz.serverData.previousQuestions));
    var skip = Math.floor(Math.random() * count);
    var questionsCollection = dbHelper.getCollection("Questions");
    questionsCollection.findOne({
        "_id": {"$nin": session.quiz.serverData.previousQuestions}
    }, {skip: skip}, function (err, question) {
        if (err || !question) {
            callback(new excptions.GeneralError(500, "Error retrieving next question from database"));
            return;
        }

        session.quiz.clientData.currentQuestionIndex++;
        session.quiz.clientData.currentQuestion = {"text" : question.text, "answers" : question.answers};

        //Add this question id to the list of questions already asked during this quiz
        session.quiz.serverData.previousQuestions.push(question._id);

        callback(null, dbHelper, session);
    })
};

function clearCorrectProperty(dbHelper, session, callback) {
    session.quiz.clientData.currentQuestion.answers.forEach(function (element, index, array) {
        delete element["correct"];
    })
    callback(null, dbHelper, session);
};
