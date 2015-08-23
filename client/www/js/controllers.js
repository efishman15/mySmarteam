angular.module('mySmarteam.controllers', ['mySmarteam.services', 'ngResource', 'ngAnimate'])

    .controller('AppCtrl', function ($scope, $rootScope, $state, $ionicLoading, UserService, ErrorService, MyAuthService, authService, InfoService, $translate, $ionicPopover) {

        InfoService.getLanguages(
            function (data) {
                $rootScope.languages = data;
            },
            ErrorService.logErrorAndAlert);

        $scope.changeLanguage = function (language) {
            $rootScope.user.settings.language = language.value;
            $translate.use(language.value);
        };

        $rootScope.$on('loading:show', function () {
            $ionicLoading.show({
                    template: "<span dir='" + $rootScope.languages[$rootScope.user.settings.language].direction + "'>" + $translate.instant('LOADING') + "</span>"
                }
            )
        });

        $rootScope.$on('loading:hide', function () {
            $ionicLoading.hide()
        })

        $rootScope.$on('event:auth-loginRequired', function (e, rejection) {
                UserService.getLoginStatus(function (success) {
                        UserService.facebookServerConnect(
                            function (data) {
                                authService.loginConfirmed(null, function (config) {
                                    return MyAuthService.confirmLogin(data.token, config);
                                });
                            },
                            function (status, error) {
                                $state.go('app.home', {}, {reload: false, inherit: true});
                            }
                        )
                    },
                    function (error) {
                        $state.go('app.home', {}, {reload: false, inherit: true});
                    });
            }
        );
    })

    .controller('HomeCtrl', function ($scope, $rootScope, $state, UserService, ErrorService, $ionicHistory) {
        $scope.$on('$ionicView.beforeEnter', function () {
            if ($rootScope.session) {
                $ionicHistory.nextViewOptions({
                    disableBack: true
                });
                $state.go('app.contests', {}, {reload: false, inherit: true});
            }
            else if (!$rootScope.user) {
                UserService.initUser();
            }
        });

        $scope.facebookConnect = function () {
            UserService.facebookClientConnect(function (session) {
                $ionicHistory.nextViewOptions({
                    disableBack: true
                });
                $state.go('app.contests', {}, {reload: false, inherit: true});
            })
        }
    })

    .controller('ContestsCtrl', function ($scope, $state, $rootScope, $ionicHistory) {

        $scope.$on('$ionicView.beforeEnter', function () {
            if (!$rootScope.session) {
                $ionicHistory.nextViewOptions({
                    disableBack: true
                });
                $state.go('app.home', {}, {reload: false, inherit: true});
            }
        });

        var c = document.getElementById("myCanvas");
        var ctx = c.getContext("2d");
        ctx.font = "10px Arial";

        var contestEndsWidth = ctx.measureText("מסתיימת בעוד 3 ימים").width;
        var contestParticipantsWidth = ctx.measureText("משתתפים: 30").width;

        $scope.dataSources =
            [
                {
                    "contestId": 1,
                    chart: {
                        caption: "מי יותר חכם",
                        subCaption: "הבנים או הבנות",
                        "baseFont": "Arial",
                        "showBorder": 1,
                        "showCanvasBorder": 1,
                        "yAxisMinValue": 0.0,
                        "yAxisMaxValue": 1.0,
                        "numDivLines": 0,
                        "numberScaleValue": ".01",
                        "numberScaleUnit": "%",
                        "showYAxisValues": 0,
                        "showCanvasBg": 0,
                        "showCanvasBase": 0,
                        "valueFontSize": 12,
                        "labelFontSize": 14,
                        "chartBottomMargin": 30
                    },
                    data: [
                        {
                            label: "הבנים",
                            value: "0.55",
                            "toolText": "הצטרפו לקבוצת הבנים"
                        },
                        {
                            label: "הבנות",
                            value: "0.45",
                            "toolText": "הצטרפו לקבוצת הבנות"
                        }
                    ],
                    "annotations": {
                        "groups": [
                            {
                                "id": "infobar",
                                "items": [
                                    {
                                        "id": "label",
                                        "type": "text",
                                        "text": "מסתיימת בעוד 3 ימים",
                                        "x": "$chartendx - " + (contestEndsWidth / 2 + 3),
                                        "y": "$chartendy - 8",
                                        "fontSize": 10,
                                        "font": "Arial",
                                        "fontColor": "#FF0000"
                                    },
                                    {
                                        "id": "label",
                                        "type": "text",
                                        "text": "משתתפים: 30",
                                        "x": "$chartstartx + " + (contestParticipantsWidth / 2 + 3),
                                        "y": "$chartendy - 8",
                                        "fontSize": 10,
                                        "font": "Arial",
                                        "fontColor": "#FF0000"
                                    }
                                ]
                            }
                        ]
                    },
                },
                {
                    "contestId": 2,
                    "chart": {
                        "plotBorderAlpha": 0,
                        "caption": "מי יותר חכם",
                        "subCaption": "אוהדי מכבי או אוהדי הפועל",
                        "baseFont": "Arial",
                        "baseFontSize": 12,
                        "showBorder": 1,
                        "showCanvasBorder": 1,
                        "yAxisMinValue": 0.0,
                        "yAxisMaxValue": 1.0,
                        "numDivLines": 0,
                        "numberScaleValue": ".01",
                        "numberScaleUnit": "%",
                        "showYAxisValues": 0,
                        "showCanvasBg": 0,
                        "showCanvasBase": 0,
                        "valueFontSize": 12,
                        "labelFontSize": 16,
                        "chartBottomMargin": 25,
                        "valuePadding": 0,
                        "useroundedges": "1"
                    },
                    "data": [
                        {
                            "label": "אוהדי מכבי",
                            "value": "0.2",
                            "toolText": "הצטרפו לקבוצת אוהדי מכבי"
                        },
                        {
                            "label": "אוהדי הפועל",
                            "value": "0.8",
                            "toolText": "הצטרפו לקבוצת אוהדי הפועל"
                        }
                    ],
                    "annotations": {
                        "groups": [
                            {
                                "id": "infobar",
                                "items": [
                                    {
                                        "id": "label",
                                        "type": "text",
                                        "text": "מסתיימת בעוד 4 שעות",
                                        "x": "$chartendx - " + (contestEndsWidth / 2 + 3),
                                        "y": "$chartendy - 8",
                                        "fontSize": 10,
                                        "font": "Arial",
                                        "fontColor": "#FF0000"
                                    },
                                    {
                                        "id": "label",
                                        "type": "text",
                                        "text": "משתתפים: 45",
                                        "x": "$chartstartx + " + (contestParticipantsWidth / 2 + 3),
                                        "y": "$chartendy - 8",
                                        "fontSize": 10,
                                        "font": "Arial",
                                        "fontColor": "#FF0000"
                                    }
                                ]
                            }
                        ]
                    },
                }
            ];

        $scope.playContest = function (contestId) {
            $state.go('app.quiz', {contestId: contestId}, {reload: false, inherit: true});
        }

        $scope.fcEvents = {
            "dataplotClick": function (eventObj, dataObj) {
                teamClicked(dataObj.categoryLabel);
            },
            "dataLabelClick": function (eventObj, dataObj) {
                teamClicked(dataObj.text);
            }
        }

        function teamClicked(team) {
            alert("הצטרפתם לקבוצת " + team);
        }

        $scope.$on('$ionicView.beforeEnter', function () {
            // TODO: Retrieve contests
        });
    })

    .controller('QuizCtrl', function ($scope, $rootScope, $state, $stateParams, UserService, QuizService, ErrorService, $ionicHistory, $translate) {

        $scope.$on('$ionicView.beforeEnter', function () {

            QuizService.start({"contestId": $stateParams.contestId},
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
                if ($rootScope.session.settings.sound == true) {
                    document.getElementById("audioSound").src = "";
                }
                if ($scope.quiz.finished == true) {
                    // using the ionicViewService to hide the back button on next view
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });
                    $rootScope.session.score += $scope.quiz.score;
                    $state.go('app.quizResult', {
                        score: $scope.quiz.score,
                        contest: $scope.quiz.contest
                    }, {reload: false, inherit: true});
                }
                else {
                    getNextQuestion();
                }
            }
        };

        $scope.toggleSound = function () {
            UserService.toggleSound(
                function () {
                    $rootScope.session.settings.sound = !$rootScope.session.settings.sound;
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
                    if (data.contest) {
                        $scope.quiz.contest = data.contest;
                    }
                    if (data.correct == true) {
                        correctAnswerId = answerId;
                        $scope.quiz.currentQuestion.answers[answerId - 1].answeredCorrectly = true;
                        if ($rootScope.session.settings.sound == true) {
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
                    if ($rootScope.session.settings.sound == true) {
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
            if (!$stateParams.score || !$stateParams.contest) {
                //Probably view is refreshed in browser - go back to pick a subject
                $state.go('app.contests', {}, {reload: false, inherit: true});
                return;
            }
            $scope.score = $stateParams.score;
            $scope.contest = $stateParams.contest;
        });

        $scope.returnToContests = function () {
            $ionicHistory.clearHistory();
            $ionicHistory.nextViewOptions({
                disableBack: true,
                historyRoot: true
            });
            $state.go('app.contests', {}, {reload: false, inherit: true});
        }
    })

    .controller('LogoutCtrl', function ($scope, $rootScope, $state, UserService, ErrorService, $ionicHistory, $translate, $stateParams) {
        $scope.$on('$ionicView.beforeEnter', function () {
            UserService.logout(function () {
                    // using the ionicViewService to hide the back button on next view
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });

                    $translate.use($rootScope.user.settings.language);
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

        $scope.openLanguagePopover = function ($event) {
            $scope.languagePopover.show($event);
        };

        $scope.closeLanguagePopover = function (language) {
            $scope.languagePopover.hide();
        };

        //Cleanup the popover when we're done with it!
        $scope.$on('$destroy', function () {
            $scope.languagePopover.remove();
        });

        $scope.$on('$ionicView.beforeLeave', function () {

            if (JSON.stringify($scope.localViewData) != JSON.stringify($rootScope.session.settings)) {
                //Dirty settings - save to server
                var postData = {"settings": $scope.localViewData};
                UserService.saveSettingsToServer(postData,
                    function (data) {
                        if ($scope.localViewData.language != $rootScope.session.settings.language) {
                            $translate.use($scope.localViewData.language);
                        }
                        $rootScope.user.settings = $scope.localViewData;
                        $rootScope.session.settings = $scope.localViewData;
                    }, ErrorService.logError);
            }
        });
    })

    .controller('OtherwiseCtrl', function ($scope, $rootScope, $state, $ionicHistory) {
        $scope.$on('$ionicView.beforeEnter', function () {
            $ionicHistory.nextViewOptions({
                disableBack: true
            });
            if ($rootScope.session || ($rootScope.user && $rootScope.user.thirdParty)) {
                $state.go('app.contests', {}, {reload: false, inherit: true});
            }
            else {
                $state.go('app.home', {}, {reload: false, inherit: true});
            }
        });
    })

