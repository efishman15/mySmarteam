angular.module('studyB4.controllers', ['studyB4.services', 'ngResource', 'ngAnimate'])

    .controller('AppCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, MyAuthService, authService) {

        $scope.updateSound = function () {
            UserService.setStoreUser($rootScope.user);
        };
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

    .controller('HomeCtrl', function ($scope, $rootScope) {
        //Figure out the user's language based on geo information (country code by ip)

        $scope.$on('$ionicView.beforeEnter', function () {
            if ($rootScope.isLoggedOn == true) {
                $state.go('app.play', {}, {reload: true, inherit: true});
            }
        });
    })

    .controller('PlayCtrl', function ($scope, $state, PlayService, ErrorService) {

        $scope.$on('$ionicView.beforeEnter', function () {
            PlayService.getSubjects(
                function (data) {
                    $scope.subjects = data;
                },
                ErrorService.logErrorAndAlert)
        });

        $scope.play = function (subjectId) {
            $state.go('app.quiz', {subjectId: subjectId}, {reload: true, inherit: true});
        };
    })

    .controller('QuizCtrl', function ($scope, $rootScope, $state, $stateParams, QuizService, ErrorService, $ionicHistory) {

        $scope.$on('$ionicView.beforeEnter', function () {

            if (!$stateParams.subjectId) {
                //Probably view is refreshed in browser - go back to pick a subject
                $state.go('app.play', {}, {reload: true, inherit: true});
                return;
            }

            QuizService.start($stateParams.subjectId,
                function (data) {
                    $scope.quiz = data;
                    $scope.quiz.currentQuestion.answered = false;
                },
                ErrorService.logErrorAndAlert)
        });

        function getNextQuestion() {
            QuizService.nextQuestion(
                function (data) {
                    $scope.quiz = data;
                    $scope.quiz.currentQuestion.answered = false;
                },
                ErrorService.logErrorAndAlert)
        };

        $scope.buttonAnimationEnded = function (button, event) {

            if ($scope.correctButtonId == button.id) {
                if ($rootScope.user.settings.sound == true) {
                    document.getElementById("audioSound").src = "";
                }
                if ($scope.quiz.finished == true) {
                    // using the ionicViewService to hide the back button on next view
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });
                    $state.go('app.quizResult', {score: $scope.quiz.score}, {reload: true, inherit: true});
                }
                else {
                    getNextQuestion();
                }
            }
        };

        $scope.submitAnswer = function (answerId) {
            $scope.quiz.currentQuestion.answered = true;
            QuizService.answer({"id": answerId},
                function (data) {
                    var correctAnswerId;
                    var soundFile;
                    $scope.quiz.score = data.score;
                    if (data.correct == true) {
                        correctAnswerId = answerId;
                        $scope.quiz.currentQuestion.answers[answerId - 1].answeredCorrectly = true;
                        if ($rootScope.user.settings.sound == true) {
                            soundFile = "audio/correct.ogg";
                        }
                    }
                    else {
                        soundFile = "audio/wrong.ogg";
                        correctAnswerId = data.correctAnswerId;
                        $scope.quiz.currentQuestion.answers[answerId - 1].answeredCorrectly = false;
                        setTimeout(function () {
                            $scope.$apply(function () {
                                $scope.quiz.currentQuestion.answers[data.correctAnswerId - 1].correct = true;
                            })
                        }, 3000);
                    }

                    //Play sound if sound is on
                    if ($rootScope.user.settings.sound == true) {
                        document.getElementById("audioSound").src = soundFile;
                    }

                    $scope.correctButtonId = "buttonAnswer" + correctAnswerId;
                },
                ErrorService.logErrorAndAlert)
        }
    })

    .controller('QuizResultCtrl', function ($scope, $stateParams, $state) {
        $scope.$on('$ionicView.beforeEnter', function () {
            if ($stateParams.score == null) {
                //Probably view is refreshed in browser - go back to pick a subject
                $state.go('app.play', {}, {reload: true, inherit: true});
                return;
            }
            $scope.score = $stateParams.score;
        });
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
        });
    })

    .controller('SettingsCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, $ionicHistory) {

        $scope.chooseLanguage = function () {
            alert("choose lang...");
        }
    })