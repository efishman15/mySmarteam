angular.module('mySmarteam.controllers', ['mySmarteam.services', 'ngResource', 'ngAnimate'])

    .controller('AppCtrl', function ($scope, $rootScope, $state, LoginService, $ionicLoading, UserService, ErrorService, MyAuthService, authService, InfoService, $translate, $ionicPopover) {

        InfoService.getLanguages(
            function (data) {
                $rootScope.languages = data;
            },
            ErrorService.logErrorAndAlert);

        $scope.changeLanguage = function (language) {
            $rootScope.storedUser.settings.interfaceLanguage = language.value;
            UserService.setStoreUser($rootScope.storedUser);
            $translate.use(language.value);
        };

        $rootScope.$on('loading:show', function () {
            $ionicLoading.show({
                    template: "<span dir='" + $rootScope.languages[$rootScope.storedUser.settings.interfaceLanguage].direction + "'>" + $translate.instant('LOADING') + "</span>"
                }
            )
        })

        $rootScope.$on('loading:hide', function () {
            $ionicLoading.hide()
        })


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
            if ($rootScope.session.settings.passwordProtected == true) {
                $scope.nextStateAfterPassword = nextState;
                $scope.openPasswordPopover($event);
            }
            else {
                $state.go(nextState, {}, {reload: false, inherit: true});
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

            $rootScope.storedUser.email = registrationForm.email.$modelValue;
            $rootScope.storedUser.password = registrationForm.password.$modelValue;
            $rootScope.storedUser.geoInfo = $rootScope.geoInfo;

            LoginService.register($rootScope.storedUser,
                function (data) {
                    $ionicHistory.clearHistory();
                    $ionicHistory.nextViewOptions({
                        disableBack: true,
                        historyRoot: true
                    });
                    $state.go('app.play', {}, {reload: false, inherit: true});
                },
                function (status, error) {

                    //Reset $rootScope.storedUser fields
                    $rootScope.storedUser.email = null;
                    $rootScope.storedUser.password = null;
                    delete $rootScope.storedUser["geoInfo"];

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

            $rootScope.storedUser.email = loginForm.email.$modelValue;
            $rootScope.storedUser.password = loginForm.password.$modelValue;
            var currentInterfaceLanguage = $rootScope.storedUser.settings.interfaceLanguage;

            LoginService.login($rootScope.storedUser,
                function (data) {
                    $ionicHistory.clearHistory();
                    $ionicHistory.nextViewOptions({
                        disableBack: true,
                        historyRoot: true
                    });
                    if ($rootScope.session.settings.interfaceLanguage != currentInterfaceLanguage) {
                        $translate.use($rootScope.session.settings.interfaceLanguage);
                    }
                    $state.go('app.play', {}, {reload: false, inherit: true});
                },
                function (status, error) {
                    //Reset $rootScope.storedUser fields
                    $rootScope.storedUser.email = null;
                    $rootScope.storedUser.password = null;

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
            if ($rootScope.session) {
                $state.go('app.play', {}, {reload: false, inherit: true});
            }
        });
    })

    .controller('PlayCtrl', function ($scope, $state, $rootScope, PlayService, ErrorService) {

        $scope.$on('$ionicView.enter', function () {
            $scope.welcomeData = {"name": $rootScope.session.profiles[$rootScope.session.settings.profileId].name};
            PlayService.getSubjectsChooser($rootScope.session.profiles[$rootScope.session.settings.profileId],
                function (result) {
                    $scope.availableSubjects = result.availableSubjects;
                    $scope.subjects = result.localSubjects;
                }, ErrorService.logErrorAndAlert);
        });

        $scope.subjectList = function () {
            return PlayService.subjectList($scope.availableSubjects);
        }

        $scope.subjectChange = function (subject) {
            if (subject.checked == true) {
                $scope.availableSubjects.checked++;
            }
            else {
                $scope.availableSubjects.checked--;
            }
        }

        $scope.play = function () {
            var subjects
            if ($scope.availableSubjects.checked == 0) {
                subjects = null;
            }
            else {
                subjects = [];
                for (var i = 0; i < $scope.availableSubjects.subjects.length; i++) {
                    if ($scope.availableSubjects.subjects[i].checked == true) {
                        subjects.push($scope.availableSubjects.subjects[i].subjectId);
                    }
                }
            }

            $state.go('app.quiz', {subjects: subjects}, {reload: false, inherit: true});
        };
    })

    .controller('QuizCtrl', function ($scope, $rootScope, $state, $stateParams, UserService, QuizService, ErrorService, $ionicHistory, $translate) {

        $scope.$on('$ionicView.beforeEnter', function () {

            if ($rootScope.session.settings.interfaceLanguage != $rootScope.session.profiles[$rootScope.session.settings.profileId].quizLanguage) {
                $translate.use($rootScope.session.profiles[$rootScope.session.settings.profileId].quizLanguage)
            }

            QuizService.start({"subjects": $stateParams.subjects},
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
                if ($rootScope.session.profiles[$rootScope.session.settings.profileId].sound == true) {
                    document.getElementById("audioSound").src = "";
                }
                if ($scope.quiz.finished == true) {
                    // using the ionicViewService to hide the back button on next view
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });
                    $rootScope.session.profiles[$rootScope.session.settings.profileId].score += $scope.quiz.score;
                    $state.go('app.quizResult', {score: $scope.quiz.score}, {reload: false, inherit: true});
                }
                else {
                    getNextQuestion();
                }
            }
        };

        $scope.toggleSound = function () {
            UserService.toggleSound(
                function () {
                    $rootScope.session.profiles[$rootScope.session.settings.profileId].sound = !$rootScope.session.profiles[$rootScope.session.settings.profileId].sound;
                },
                ErrorService.logError);
        }

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
                        if ($rootScope.session.profiles[$rootScope.session.settings.profileId].sound == true) {
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
                    if ($rootScope.session.profiles[$rootScope.session.settings.profileId].sound == true) {
                        document.getElementById("audioSound").src = soundFile;
                    }

                    $scope.correctButtonId = "buttonAnswer" + correctAnswerId;
                },
                function (status, error) {
                    ErrorService.logErrorAndAlert(status, error);
                    $ionicHistory.goBack();
                })
        }
    })

    .controller('QuizResultCtrl', function ($scope, $rootScope, $stateParams, $state, $translate, $ionicHistory) {
        $scope.$on('$ionicView.beforeEnter', function () {
            if ($stateParams.score == null) {
                //Probably view is refreshed in browser - go back to pick a subject
                $state.go('app.play', {}, {reload: false, inherit: true});
                return;
            }
            $scope.score = $stateParams.score;
        });

        $scope.returnToPlay = function () {
            $ionicHistory.clearHistory();
            $ionicHistory.nextViewOptions({
                disableBack: true,
                historyRoot: true
            });
            $state.go('app.play', {}, {reload: false, inherit: true});
        }

        $scope.$on('$ionicView.beforeLeave', function () {
            if ($rootScope.session.profiles[$rootScope.session.settings.profileId].interfaceLanguage != $rootScope.session.profiles[$rootScope.session.settings.profileId].quizLanguage) {
                $translate.use($rootScope.session.profiles[$rootScope.session.settings.profileId].quizLanguage);
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

                    $translate.use($rootScope.storedUser.settings.interfaceLanguage);
                    $state.go('app.home', {}, {reload: false, inherit: true});
                },
                ErrorService.logErrorAndAlert)
        });
    })

    .controller('SettingsCtrl', function ($scope, $rootScope, $ionicPopover, $ionicSideMenuDelegate, UserService, ErrorService, $translate, $stateParams) {

        //Clone the user settings from the root object - all screen changes will work on the local cloned object
        //only "Apply" button will send the changes to the server
        $scope.$on('$ionicView.beforeEnter', function () {
            $scope.localViewData = JSON.parse(JSON.stringify($rootScope.session.settings));
        });

        //-------------------------------------------------------
        // Choose Language Popover
        //-------------------------------------------------------
        $ionicPopover.fromTemplateUrl('templates/chooseLanguage.html', {
            scope: $scope
        }).then(function (languagePopover) {
            $scope.languagePopover = languagePopover;
        });

        $scope.openLanguagePopover = function (property, $event) {
            $scope.languageProperty = property;
            $scope.languagePopover.show($event);
        };

        $scope.closeLanguagePopover = function (language) {
            $scope.languagePopover.hide();
        };

        //-------------------------------------------------------
        // Choose Profile Popover
        //-------------------------------------------------------
        $ionicPopover.fromTemplateUrl('templates/chooseProfile.html', {
            scope: $scope
        }).then(function (profilePopover) {
            $scope.profilePopover = profilePopover;
        });

        $scope.openProfilePopover = function ($event) {
            $scope.profilePopover.show($event);
        };

        $scope.closeProfilePopover = function (profile) {
            $scope.profilePopover.hide();
        };

        //Cleanup the popover when we're done with it!
        $scope.$on('$destroy', function () {
            $scope.languagePopover.remove();
            $scope.profilePopover.remove();
        });

        $scope.$on('$ionicView.beforeLeave', function () {
            if ($rootScope.storedUser.settings.passwordProtected == true && !$stateParams.password) {
                //Should not be here if no password
                return;
            }

            if (JSON.stringify($scope.localViewData) != JSON.stringify($rootScope.session.settings)) {
                //Dirty settings - save to server
                var postData = {"settings": $scope.localViewData};
                if ($stateParams.password) {
                    postData.password = $stateParams.password;
                }
                UserService.saveSettingsToServer(postData,
                    function (data) {
                        if ($scope.localViewData.interfaceLanguage != $rootScope.session.settings.interfaceLanguage) {
                            $translate.use($scope.localViewData.interfaceLanguage);
                        }
                        $rootScope.storedUser.settings = $scope.localViewData;
                        $rootScope.session.settings = $scope.localViewData;
                        UserService.setStoreUser($rootScope.storedUser);
                    }, ErrorService.logError);
            }
        });
    })

    .controller('ProfilesCtrl', function ($scope, $rootScope, $state, $ionicPopover, $ionicSideMenuDelegate, UserService, ErrorService, $translate, $stateParams) {

        $scope.addProfile = function () {
            $state.go('app.profile', {password: $stateParams.password, mode: "add"}, {reload: false, inherit: true});
        }
        $scope.editProfile = function (profile) {
            $state.go('app.profile', {password: $stateParams.password, mode: "edit", profile: profile}, {
                reload: false,
                inherit: true
            });
        }
    })

    .controller('ProfileCtrl', function ($scope, $state, $rootScope, $ionicPopover, $translate, $stateParams, $ionicHistory, UserService, ErrorService, $ionicPopup, PlayService) {

        //Clone the user settings from the root object - all screen changes will work on the local cloned object
        //only "Apply" button will send the changes to the server
        $scope.$on('$ionicView.beforeEnter', function () {
            if ($stateParams.mode) {
                $scope.mode = $stateParams.mode;
                if ($stateParams.mode == "edit") {
                    if ($stateParams.profile) {
                        $scope.localViewData = JSON.parse(JSON.stringify($stateParams.profile));
                        retrieveAvailableSubjects();
                    }
                    else {
                        $state.go('app.profiles', {}, {reload: false, inherit: true});
                        return;
                    }
                }
                else {
                    //Copy data from first profile, and then clear the
                    $scope.localViewData = {
                        "name": null,
                        "quizLanguage": $rootScope.storedUser.settings.interfaceLanguage,
                        "subjects": null,
                        "sound": true,
                        "score": 0
                    }
                    retrieveAvailableSubjects();
                }
            }
            else {
                $state.go('app.profiles', {}, {reload: false, inherit: true});
            }
        });

        $scope.subjectList = function () {
            return PlayService.subjectList($scope.availableSubjects);
        }

        function retrieveAvailableSubjects() {
            PlayService.getSubjectsChooser($scope.localViewData,
                function (result) {
                    $scope.availableSubjects = result.availableSubjects;
                    $scope.localViewData.subjects = result.localSubjects;
                }, ErrorService.logErrorAndAlert);
        }

        $scope.subjectChange = function (subject) {
            if (subject.checked == true) {
                $scope.availableSubjects.checked++;
            }
            else {
                $scope.availableSubjects.checked--;
            }
            if ($scope.availableSubjects.checked == 0) {
                $scope.localViewData.subjects = null;
            }
            else {
                $scope.localViewData.subjects = [];
                for (var i = 0; i < $scope.availableSubjects.subjects.length; i++) {
                    if ($scope.availableSubjects.subjects[i].checked == true) {
                        $scope.localViewData.subjects.push($scope.availableSubjects.subjects[i].subjectId);
                    }
                }
            }
        }

        //Cleanup the popover when we're done with it!
        $scope.$on('$destroy', function () {
            $scope.languagePopover.remove();
            $scope.subjectsPopover.remove();
        });

        $scope.getTitle = function () {
            if ($stateParams.mode == "add") {
                return "ADD_PROFILE";
            }
            else if ($stateParams.mode == "edit") {
                return "EDIT_PROFILE"
            }
            else {
                return null;
            }
        }

        //-------------------------------------------------------
        // Choose Language Popover
        //-------------------------------------------------------
        $ionicPopover.fromTemplateUrl('templates/chooseLanguage.html', {
            scope: $scope
        }).then(function (languagePopover) {
            $scope.languagePopover = languagePopover;
        });

        $scope.openLanguagePopover = function (property, $event) {
            $scope.languageProperty = property;
            $scope.languagePopover.show($event);
        };

        $scope.closeLanguagePopover = function (language) {
            $scope.languagePopover.hide();
            retrieveAvailableSubjects();
        };

        $scope.goBack = function () {
            $ionicHistory.goBack();
        }

        //-------------------------------------------------------
        // Choose Subjects Popover
        //-------------------------------------------------------
        $ionicPopover.fromTemplateUrl('templates/chooseSubjects.html', {
            scope: $scope
        }).then(function (subjectsPopover) {
            $scope.subjectsPopover = subjectsPopover;
        });

        $scope.openSubjectsPopover = function ($event) {
            $scope.subjectsPopover.show($event);
        };

        $scope.closeSubjectsPopover = function () {
            $scope.subjectsPopover.hide();
        };

        $scope.goBack = function () {
            $ionicHistory.goBack();
        }

        //Fill the years combo
        $scope.years = [];
        var currentYear = new Date().getFullYear();
        for (var i = currentYear; i > currentYear - 120; i--) {
            $scope.years.push(i);
        }

        $scope.setProfile = function () {
            if ($stateParams.mode == "add" || ($stateParams.mode == "edit" && JSON.stringify($stateParams.profile) != JSON.stringify($scope.localViewData))) {
                var postData = {"profile": $scope.localViewData};
                if ($stateParams.password) {
                    postData.password = $stateParams.password;
                }
                //Add/update the new/updated profile to the server and in the local $rootScope
                UserService.setProfile(postData,
                    function (profile) {
                        $rootScope.session.profiles[profile.id] = profile;
                        $scope.goBack();
                    }, ErrorService.logErrorAndAlert);
            }
            else {
                $scope.goBack();
            }
        };

        $scope.removeProfile = function () {

            var confirmPopup = $ionicPopup.confirm({
                title: $translate.instant("CONFIRM_REMOVE_PROFILE_TITLE", {name: $scope.localViewData.name}),
                template: $translate.instant("CONFIRM_REMOVE_PROFILE_TEMPLATE", {name: $scope.localViewData.name}),
                cssClass: $rootScope.languages[$rootScope.storedUser.settings.interfaceLanguage].direction,
                okText: $translate.instant("OK"),
                cancelText: $translate.instant("CANCEL")
            });

            confirmPopup.then(function (res) {
                if (res) {
                    var postData = {"profileId": $scope.localViewData.id};
                    if ($stateParams.password) {
                        postData.password = $stateParams.password;
                    }
                    UserService.removeProfile(postData,
                        function (data) {
                            delete $rootScope.session.profiles[$scope.localViewData.id];
                            //If deleting the current session's profile - point to the first profile left
                            if ($rootScope.session.settings.profileId == postData.profileId) {
                                $rootScope.session.settings.profileId = Object.keys($rootScope.session.profiles)[0];
                                $ionicPopup.alert({
                                    cssClass: $rootScope.languages[$rootScope.storedUser.settings.interfaceLanguage].direction,
                                    title: $translate.instant("PROFILE_AUTOMATICALLY_CHANGED_TITLE"),
                                    template: $translate.instant("PROFILE_AUTOMATICALLY_CHANGED_TEMPLATE", {name: $rootScope.session.profiles[$rootScope.session.settings.profileId].name}),
                                    okText: $translate.instant("OK")
                                });
                            }

                            $scope.goBack();
                        }, ErrorService.logErrorAndAlert)
                }
            })
        };

        $scope.hideRemoveProfile = function () {
            if ($stateParams.mode == 'add' || Object.keys($rootScope.session.profiles).length == 1) {
                return true;
            }
            else {
                return false;
            }
        }
    }
)
;