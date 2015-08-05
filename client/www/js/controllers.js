angular.module('studyB4.controllers', ['studyB4.services', 'ngResource', 'ngAnimate'])

    .controller('AppCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, MyAuthService, authService, InfoService, $translate, $ionicPopover) {

        InfoService.getLanguages(
            function (data) {
                $rootScope.languages = data;
                $rootScope.languages.keys = Object.keys(data);
            },
            ErrorService.logErrorAndAlert)

        $scope.changeLanguage = function (language) {
            $rootScope.user.settings.interfaceLanguage = language.value;
            UserService.setStoreUser($rootScope.user);
            $translate.use(language.value);
        };

        $ionicPopover.fromTemplateUrl('templates/settingsPassword.html', {
            scope: $scope
        }).then(function (passwordPopover) {
            $scope.passwordPopover = passwordPopover;
        });

        $scope.openPasswordPopover = function ($event) {
            $scope.passwordPopover.show($event);
        };

        $scope.closePasswordPopover = function (password) {
            $scope.passwordPopover.hide();
            //Check the password vs. the server
            LoginService.confirmPassword({"password": password},
                function (data) {
                    if (data.confirmed == true) {
                        $state.go($scope.nextStateAfterPassword, {password: password}, {reload: false, inherit: true});
                    }
                },
                ErrorService.logErrorAndAlert
            )
        };

        //Cleanup the popover when we're done with it!
        $scope.$on('$destroy', function () {
            $scope.passwordPopover.remove();
        });

        $scope.checkPassword = function (nextState, $event) {
            if ($rootScope.user.settings.passwordProtected == true) {
                $scope.nextStateAfterPassword = nextState;
                $scope.openPasswordPopover($event);
            }
            else {
                $state.go(nextState, {}, {reload: false, inherit: true});
            }
        }

        $scope.updateSound = function () {
            UserService.setStoreUser($rootScope.user);
            if ($rootScope.isLoggedOn == true) {
                UserService.saveSettingsToServer($rootScope.user.settings);
            }
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

                    if (error.fieldName) {
                        //Error in a specific field
                        registrationForm[error.fieldName].$invalid = true;
                        if (!registrationForm[error.fieldName].$error) {
                            registrationForm[error.fieldName].$error = {};
                        }
                        registrationForm[error.fieldName].$error[error.message] = true;
                    }
                    else {
                        //General Error in the server
                        if (!registrationForm.serverError.$error) {
                            registrationForm.serverError.$error = {};
                        }
                        registrationForm.serverError.$error[error.message] = true;
                        ErrorService.logError(status, error);
                    }
                });
        }
    })

    .controller('LoginCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, MyAuthService, authService, $ionicHistory, $translate) {

        $scope.fieldChange = LoginService.fieldChange;

        $scope.login = function (loginForm) {

            $rootScope.user.email = loginForm.email.$modelValue;
            $rootScope.user.password = loginForm.password.$modelValue;
            var currentInterfaceLanguage = $rootScope.user.settings.interfaceLanguage;

            LoginService.login($rootScope.user,
                function (data) {
                    $ionicHistory.clearHistory();
                    $ionicHistory.nextViewOptions({
                        disableBack: true,
                        historyRoot: true
                    });
                    if ($rootScope.user.settings.interfaceLanguage != currentInterfaceLanguage) {
                        $translate.use($rootScope.user.settings.interfaceLanguage);
                    }
                    $state.go('app.play', {}, {reload: false, inherit: true});
                },
                function (status, error) {
                    //Reset $rootScope.user fields
                    $rootScope.user.email = null;
                    $rootScope.user.password = null;

                    if (error.fieldName) {
                        //Error in a specific field
                        loginForm[error.fieldName].$invalid = true;
                        if (!loginForm[error.fieldName].$error) {
                            loginForm[error.fieldName].$error = {};
                        }
                        loginForm[error.fieldName].$error[error.message] = true;
                    }
                    else {
                        //General Error in the server
                        if (!loginForm.serverError.$error) {
                            loginForm.serverError.$error = {};
                        }
                        loginForm.serverError.$error[error.message] = true;
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

    .controller('PlayCtrl', function ($scope, $state, $rootScope, PlayService, ErrorService) {

        $scope.$on('$ionicView.enter', function () {
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

    .controller('QuizCtrl', function ($scope, $rootScope, $state, $stateParams, QuizService, ErrorService, $ionicHistory, $translate) {

        $scope.$on('$ionicView.beforeEnter', function () {

            if (!$stateParams.subjectId) {
                //Probably view is refreshed in browser - go back to pick a subject
                $state.go('app.play', {}, {reload: false, inherit: true});
                return;
            }

            if ($rootScope.user.settings.interfaceLanguage != $rootScope.user.settings.questionsLanguage) {
                $translate.use($rootScope.user.settings.questionsLanguage)
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

    .controller('QuizResultCtrl', function ($scope, $rootScope, $stateParams, $state, $translate) {
        $scope.$on('$ionicView.beforeEnter', function () {
            if ($stateParams.score == null) {
                //Probably view is refreshed in browser - go back to pick a subject
                $state.go('app.play', {}, {reload: false, inherit: true});
                return;
            }
            $scope.score = $stateParams.score;
        });

        $scope.$on('$ionicView.beforeLeave', function () {
            if ($rootScope.user.settings.interfaceLanguage != $rootScope.user.settings.questionsLanguage) {
                $translate.use($rootScope.user.settings.interfaceLanguage);
            }
        });


    })

    .controller('LogoutCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, $ionicHistory, $translate, $stateParams) {
        $scope.$on('$ionicView.beforeEnter', function () {
            var logoutData = null;
            if ($stateParams.password) {
                logoutData = {"password": $stateParams.password}
            }
            LoginService.logout(logoutData,
                function () {
                    // using the ionicViewService to hide the back button on next view
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });

                    $translate.use($rootScope.user.settings.interfaceLanguage);
                    $state.go('app.home', {}, {reload: false, inherit: true});
                },
                ErrorService.logErrorAndAlert)
        });
    })

    .controller('SettingsCtrl', function ($scope, $rootScope, $ionicPopover, $ionicSideMenuDelegate, UserService, ErrorService, $translate, $stateParams) {

        //Clone the user settings from the root object - all screen changes will work on the local cloned object
        //only "Apply" button will send the changes to the server
        $scope.$on('$ionicView.beforeEnter', function () {
            $scope.settings = JSON.parse(JSON.stringify($rootScope.user.settings));
        });

        $ionicPopover.fromTemplateUrl('templates/chooseLanguage.html', {
            scope: $scope
        }).then(function (languagePopover) {
            $scope.languagePopover = languagePopover;
        });

        $scope.openLanguagePopover = function (property, $event) {
            $scope.languageProperty = property;
            $scope.languagePopover.show($event);
        };

        $scope.closeLanguagePopover = function (item) {
            $scope.languagePopover.hide();
        };

        //Cleanup the popover when we're done with it!
        $scope.$on('$destroy', function () {
            $scope.languagePopover.remove();
        });

        $scope.$on('$ionicView.beforeLeave', function () {
            if ($rootScope.user.settings.passwordProtected == true && !$stateParams.password) {
                //Should not be here if no password
                return;
            }

            if (JSON.stringify($scope.settings) != JSON.stringify($rootScope.user.settings)) {
                //Dirty settings - save to server
                var serverData = {"settings" : $scope.settings };
                if ($stateParams.password) {
                    serverData.password = $stateParams.password;
                }
                UserService.saveSettingsToServer(serverData,
                    function (data) {
                        if ($scope.settings.interfaceLanguage != $rootScope.user.settings.interfaceLanguage) {
                            $translate.use($scope.settings.interfaceLanguage);
                        }
                        $rootScope.user.settings = $scope.settings;
                    }, ErrorService.logError);
            }
        });
    })
