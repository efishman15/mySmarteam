angular.module('eddy1.controllers', ['eddy1.services', 'ngResource'])

    .controller('AppCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, MyAuthService, authService) {

        //Perform auto-login if login details are saved in store
        $rootScope.isLoggedIn = false;
        $rootScope.user = UserService.initUser();

        var currentUser = UserService.getCurrentUser();

        function silentLogin(currentUser, releaseHttpRequests) {
            //Auto silent login based on the credentials in the storage
            LoginService.login(currentUser,
                function (data) {
                    $rootScope.isLoggedIn = true;
                    $rootScope.user = currentUser;
                    console.log("logged in with token: " + data.token);
                    if (releaseHttpRequests && releaseHttpRequests == true) {
                        authService.loginConfirmed(null, function (config) {
                            return MyAuthService.confirmLogin(data.token, config);
                        });
                    }
                },
                function (status, error) {
                    UserService.setCurrentUser(UserService.initUser());
                    ErrorService.logError(status, error, false);
                }
            )
        }

        $rootScope.$on('event:auth-loginRequired', function (e, rejection) {
            $rootScope.user = UserService.getCurrentUser();
            if ($rootScope.user && !$rootScope.user.email) {
                $rootScope.user = UserService.initUser();
                $state.go('app.login', {}, {reload: true, inherit: true});
            }
            else {
                silentLogin($rootScope.user, true);
            }
        });
    })

    .controller('RegisterCtrl', function ($scope, $rootScope, $http, $state, LoginService, UserService, ErrorService, $ionicHistory) {

        $scope.fieldChange = LoginService.fieldChange;

        $scope.register = function (registrationForm) {

            var user = UserService.initUser();
            user.email = registrationForm.email.$modelValue;
            user.password = registrationForm.password.$modelValue;

            LoginService.register(user,
                function (data) {
                    UserService.setCurrentUser(user);
                    $rootScope.isLoggedIn = true;
                    $rootScope.user = user;

                    $ionicHistory.clearHistory();
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });
                    $state.go('app.play', {}, {reload: true, inherit: true});
                },
                function (status, error) {
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
                        ErrorService.logError(status, error, false);
                    }
                });
        };
    })

    .controller('LoginCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, MyAuthService, authService, $ionicHistory) {

        $scope.fieldChange = LoginService.fieldChange;

        $scope.login = function (loginForm) {

            var user = UserService.initUser();
            user.email = loginForm.email.$modelValue;
            user.password = loginForm.password.$modelValue;

            LoginService.login(user,
                function (data) {
                    UserService.setCurrentUser(user);
                    $rootScope.isLoggedIn = true;
                    $rootScope.user = user;
                    authService.loginConfirmed(null, function (config) {
                        return MyAuthService.confirmLogin(data.token, config);
                    });

                    $ionicHistory.clearHistory();
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });

                    $state.go('app.play', {}, {reload: true, inherit: true});
                },
                function (status, error) {
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
                        ErrorService.logError(status, error, false);
                    }
                });
        };
    })

    .controller('HomeCtrl', function ($scope, $rootScope, $state) {
    })

    .controller('PlayCtrl', function ($scope, $state) {
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
                function (status, error) {
                    ErrorService.logError(status, error, true);
                })
        });

        function getNextQuestion(currentCorrectAnswerId) {
            QuizService.nextQuestion(
                function (data) {

                        //Will forcibly clear all animations from buttons - to restore them to the initial state
                        for(i=0; i<$scope.quiz.currentQuestion.answers.length; i++) {
                            document.getElementById("buttonAnswer" + $scope.quiz.currentQuestion.answers[i].id).className = "button-positive";
                        }
                        $scope.quiz = data;
                        $scope.quiz.currentQuestion.answered = false;
                },
                function (status, error) {
                    ErrorService.logError(status, error, true);
                })
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
                function (status, error) {
                    ErrorService.logError(status, error, true);
                })
        };
    })

    .controller('QuizResultCtrl', function ($scope, $stateParams) {
        $scope.score = $stateParams.score;
    })

    .controller('LogoutCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, $ionicHistory) {
        $scope.$on('$ionicView.beforeEnter', function () {
            LoginService.logout(
                function (data) {
                    $rootScope.user = UserService.initUser();
                    UserService.setCurrentUser($rootScope.user);
                    $rootScope.isLoggedIn = false;

                    // using the ionicViewService to hide the back button on next view
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });

                    $state.go('app.home', {}, {reload: true, inherit: true});
                    $rootScope.$broadcast('event:auth-logoutCompleted');
                },
                function (status, error) {
                    ErrorService.logError(status, error, true);
                })
        })
    });