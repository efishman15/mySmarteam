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

        //Get the next question for the quiz
        getNextQuestion,

        //Stores the session with the quiz in the db
        session.storeSession,

        //Clears the "Correct" property from each answer before sending to client
        //clearCorrectProperty,

        //Close the db
        function (dbHelper, session, callback) {
            dbHelper.close();
            callback(null, session.quiz.clientData);
        }
    ];

    async.waterfall(operations, function (err, quizClientData) {
        if (!err) {
            res.send(200,quizClientData);
        }
        else {
            res.send(500, err);
        }
    })
};

//Get the next question
function getNextQuestion(dbHelper, session, callback) {

    var questionsCollection = dbHelper.getCollection("Questions");
    var count = questionsCollection.count();

    //substruct the questions which have already been asked
    count -= session.quiz.serverData.previousQuestions.length;

    var skip = Math.floor(Math.random() * count);

    questionsCollection.find({
        "_id": {"$nin": session.quiz.serverData.previousQuestions}
    }, {limit: 1, skip: skip}, function (err, question) {
        if (err || !question) {
            callback(new excptions.GeneralError(500, "Error retrieving next question from database"));
            return;
        }

        session.quiz.clientData.currentQuestionIndex++;
        //session.quiz.clientData.currentQuestion = question;

        //Add this question id to the list of questions already asked during this quiz
        session.quiz.serverData.previousQuestions.push(question._id);

        callback(null, dbHelper, session);
    })
};

function clearCorrectProperty(dbHelper, session, callback) {
    session.clientData.currentQuestion.answers.forEach(function (element, index, array) {
        delete element.correct;
    });
}