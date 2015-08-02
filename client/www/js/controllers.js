angular.module('studyB4.controllers', ['studyB4.services', 'ngResource', 'ngAnimate'])

    .controller('AppCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, MyAuthService, authService) {

        $scope.updateSound = function () {
            UserService.setStoreUser($rootScope.user);
        };

        $rootScope.$on('event:auth-loginRequired', function (e, rejection) {
                var currentUser = UserService.getStoreUser();
                if (!currentUser || !currentUser.email) {
                    UserService.initUser();
                    $state.go('app.login', {}, {reload: false, inherit: true});
                }
                else {

                    //Auto silent login based on the credentials in the storage
                    LoginService.login(currentUser,
                        function (data) {
                            authService.loginConfirmed(null, function (config) {
                                return MyAuthService.confirmLogin(data.token, config);
                            });
                        },
                        ErrorService.logError
                    )
                }

            }
        );
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
                        disableBack: true,
                        historyRoot: true
                    });
                    $state.go('app.play', {}, {reload: false, inherit: true});
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
                        disableBack: true,
                        historyRoot: true
                    });
                    $state.go('app.play', {}, {reload: false, inherit: true});
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

    .controller('HomeCtrl', function ($scope, $rootScope, $state) {
        $scope.$on('$ionicView.beforeEnter', function () {
            if ($rootScope.isLoggedOn == true) {
                $state.go('app.play', {}, {reload: false, inherit: true});
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
            $state.go('app.quiz', {subjectId: subjectId}, {reload: false, inherit: true});
        };
    })

    .controller('QuizCtrl', function ($scope, $rootScope, $state, $stateParams, QuizService, ErrorService, $ionicHistory) {

        $scope.$on('$ionicView.beforeEnter', function () {

            if (!$stateParams.subjectId) {
                //Probably view is refreshed in browser - go back to pick a subject
                $state.go('app.play', {}, {reload: false, inherit: true});
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
                    $state.go('app.quizResult', {score: $scope.quiz.score}, {reload: false, inherit: true});
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
                $state.go('app.play', {}, {reload: false, inherit: true});
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

    .controller('SettingsCtrl', function ($scope, $rootScope, $ionicPopover, $ionicSideMenuDelegate, UserService, ErrorService, $translate) {

        //Clone the user settings from the root object - all screen changes will work on the local cloned object
        //only "Apply" button will send the changes to the server

        $scope.$on('$ionicView.beforeEnter', function () {
            $scope.settings = JSON.parse(JSON.stringify($rootScope.user.settings));
            $ionicSideMenuDelegate.toggleLeft();
        });

        $scope.$on('$ionicView.afterLeave', function () {
            if (JSON.stringify($scope.settings) != JSON.stringify($rootScope.user.settings)) {
                //Dirty settings - save to server
                UserService.saveSettingsToServer($scope.settings,
                    function (data) {
                        if ($scope.settings.interfaceLanguage != $rootScope.user.settings.interfaceLanguage) {
                            $translate.use($scope.settings.interfaceLanguage);
                            $rootScope.user.direction = data.direction;
                        }
                        $rootScope.user.settings = $scope.settings;
                    }, ErrorService.logError);
            }
        });

        $scope.languages = [
            {"name": "English", "value": "en"},
            {"name": "Hebrew", "value": "he"},
            {"name": "Russian", "value": "ru"},
            {"name": "Spanish", "value": "es"}
        ]

        $ionicPopover.fromTemplateUrl('templates/chooseLanguage.html', {
            scope: $scope
        }).then(function (popover) {
            $scope.popover = popover;
        });

        $scope.openPopover = function (property, $event) {
            $scope.languageProperty = property;
            $scope.popover.show($event);
        };

        $scope.closePopover = function (item) {
            $scope.popover.hide();
        };

        $scope.getLanguageDisplayName = function (languageProperty) {
            for (var i = 0; i < $scope.languages.length; i++) {
                if ($scope.languages[i].value == $scope.settings[languageProperty]) {
                    return $scope.languages[i].name;
                }
            }
        }
    })