angular.module('studyB4.controllers', ['studyB4.services', 'ngResource'])

    .controller('AppCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, MyAuthService, authService) {

    })

    .controller('RegisterCtrl', function ($scope, $rootScope, $http, $state, LoginService, UserService, ApiService, ErrorService, $ionicHistory) {

        $scope.fieldChange = LoginService.fieldChange;

        $scope.register = function (registrationForm) {

            $rootScope.user.email = registrationForm.email.$modelValue;
            $rootScope.user.password = registrationForm.password.$modelValue;
            $rootScope.user.geoInfo = $rootScope.geoInfo;

            LoginService.register($rootScope.user,
                function (data) {
                    $ionicHistory.clearHistory();
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });
                    $state.go('app.play', {}, {reload: true, inherit: true});
                },
                function (status, error) {

                    //Reset $rootScope.user fields
                    $rootScope.user.email = null;
                    $rootScope.user.password = null;
                    delete $rootScope.user["geoInfo"];

                    registrationForm.serverError.innerHTML = error.message;
                    if (error.fieldName) {
                        //Error in a specific field
                        registrationForm[error.fieldName].$invalid = true;
                        if (!registrationForm[error.fieldName].$error) {
                            registrationForm[error.fieldName].$error = {};
                        }
                        registrationForm[error.fieldName].$error.serverError = true;
                    }
                    else {
                        //General Error in the server
                        if (!registrationForm.serverError.$error) {
                            registrationForm.serverError.$error = {};
                        }
                        registrationForm.serverError.$error.serverError = true;
                        ErrorService.logError(status, error);
                    }
                });
        }
    })

    .controller('LoginCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, MyAuthService, authService, $ionicHistory) {

        $scope.fieldChange = LoginService.fieldChange;

        $scope.login = function (loginForm) {

            $rootScope.user.email = loginForm.email.$modelValue;
            $rootScope.user.password = loginForm.password.$modelValue;

            LoginService.login($rootScope.user,
                function (data) {
                    $ionicHistory.clearHistory();
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });

                    $state.go('app.play', {}, {reload: true, inherit: true});
                },
                function (status, error) {

                    //Reset $rootScope.user fields
                    $rootScope.user.email = null;
                    $rootScope.user.password = null;

                    loginForm.serverError.innerHTML = error.message;
                    if (error.fieldName) {
                        //Error in a specific field
                        loginForm[error.fieldName].$invalid = true;
                        if (!loginForm[error.fieldName].$error) {
                            loginForm[error.fieldName].$error = {};
                        }
                        loginForm[error.fieldName].$error.serverError = true;
                    }
                    else {
                        //General Error in the server
                        if (!loginForm.serverError.$error) {
                            loginForm.serverError.$error = {};
                        }
                        loginForm.serverError.$error.serverError = true;
                        ErrorService.logError(status, error);
                    }
                });
        };
    })

    .controller('HomeCtrl', function ($scope, $rootScope, LoginService) {
        //Figure out the user's language based on geo information (country code by ip)

        if (!$rootScope.user) {
            LoginService.initLogin();
        }

        $scope.$on('$ionicView.beforeEnter', function () {
            if ($rootScope.isLoggedOn == true) {
                $state.go('app.play', {}, {reload: true, inherit: true});
            }
        });
    })

    .controller('PlayCtrl', function ($scope, $state, $rootScope, LoginService) {

        if (!$rootScope.user) {
            LoginService.initLogin();
        }

        $scope.play = function () {
            $state.go('app.quiz', {}, {reload: true, inherit: true});
        };
    })

    .controller('QuizCtrl', function ($scope, $state, QuizService, ErrorService, $ionicHistory) {
        $scope.$on('$ionicView.beforeEnter', function () {
            QuizService.start(
                function (data) {
                    $scope.quiz = data;
                    $scope.quiz.currentQuestion.answered = false;
                },
                ErrorService.logErrorAndAlert)
        });

        $scope.$on('$ionicView.afterLeave', function () {
            clearButtonAnimations();
        });

        function clearButtonAnimations() {
            //Will forcibly clear all animations from buttons - to restore them to the initial state
            for (i = 0; i < $scope.quiz.currentQuestion.answers.length; i++) {
                document.getElementById("buttonAnswer" + $scope.quiz.currentQuestion.answers[i].id).className = "button-positive";
            }
        };

        function getNextQuestion(currentCorrectAnswerId) {
            QuizService.nextQuestion(
                function (data) {
                    $scope.quiz = data;
                    $scope.quiz.currentQuestion.answered = false;
                    clearButtonAnimations();
                },
                ErrorService.logErrorAndAlert)
        };

        $scope.submitAnswer = function (answerId) {
            $scope.quiz.currentQuestion.answered = true;
            QuizService.answer({"id": answerId},
                function (data) {
                    var correctAnswerId;
                    var audioSound = document.getElementById("audioSound");
                    if (data.correct == true) {
                        correctAnswerId = answerId;
                        $scope.quiz.currentQuestion.answers[answerId - 1].answeredCorrectly = true;
                        audioSound.src = "audio/correct.ogg";
                    }
                    else {
                        audioSound.src = "audio/wrong.ogg";
                        correctAnswerId = data.correctAnswerId;
                        $scope.quiz.currentQuestion.answers[answerId - 1].answeredCorrectly = false;
                        setTimeout(function () {
                            $scope.$apply(function () {
                                $scope.quiz.currentQuestion.answers[data.correctAnswerId - 1].correct = true;
                            })
                        }, 3000);
                    }
                    document.getElementById("buttonAnswer" + correctAnswerId).addEventListener("animationend", function () {
                        audioSound.src = "";
                        this.removeEventListener("animationend", arguments.callee);
                        if ($scope.quiz.finished == true) {
                            // using the ionicViewService to hide the back button on next view
                            $ionicHistory.nextViewOptions({
                                disableBack: true
                            });
                            $state.go('app.quizResult', {score: data.score}, {reload: true, inherit: true});
                        }
                        else {
                            getNextQuestion(correctAnswerId);
                        }
                    });
                },
                ErrorService.logErrorAndAlert)
        };
    })

    .controller('QuizResultCtrl', function ($scope, $stateParams) {
        $scope.score = $stateParams.score;
    })

    .controller('LogoutCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, $ionicHistory) {
        $scope.$on('$ionicView.beforeEnter', function () {
            LoginService.logout(
                function () {
                    // using the ionicViewService to hide the back button on next view
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });

                    $state.go('app.home', {}, {reload: false, inherit: true});
                },
                ErrorService.logErrorAndAlert)
        })
    });
