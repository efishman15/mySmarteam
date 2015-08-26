angular.module('mySmarteam.controllers', ['mySmarteam.services', 'ngAnimate'])

    .controller('AppCtrl', function ($scope, $rootScope, $state, $ionicLoading, UserService, ErrorService, MyAuthService, authService, InfoService, $translate, $ionicPopover) {

        $scope.changeLanguage = function (language) {
            $rootScope.user.settings.language = language.value;
            $translate.use(language.value);

        };

        $rootScope.$on('$translateChangeEnd', function (data) {
            $rootScope.$broadcast("mySmarteam-languageChanged");
        });

        $rootScope.$on("loading:show", function () {
            $ionicLoading.show({
                    template: "<span dir='" + $rootScope.languages[$rootScope.user.settings.language].direction + "'>" + $translate.instant("LOADING") + "</span>"
                }
            )
        });

        $rootScope.$on("loading:hide", function () {
            $ionicLoading.hide()
        })

        $rootScope.$on("event:auth-loginRequired", function (e, rejection) {
                UserService.getLoginStatus(function (success) {
                        UserService.facebookServerConnect(
                            function (data) {
                                authService.loginConfirmed(null, function (config) {
                                    return MyAuthService.confirmLogin(data.token, config);
                                });
                            },
                            function (status, error) {
                                $state.go("app.home", {}, {reload: false, inherit: true});
                            }
                        )
                    },
                    function (error) {
                        $state.go("app.home", {}, {reload: false, inherit: true});
                    });
            }
        );

        $rootScope.gotoView = function(viewName, params) {
            if (!params) {
                params = {};
            }
            $state.go(viewName, params, {reload: false, inherit: true});
        }
    })

    .controller('HomeCtrl', function ($scope, $rootScope, $state, UserService, ErrorService, $ionicHistory, $ionicPopup, $translate) {

        function getDemoContestAnnotations() {
            var c = document.getElementById("myCanvas");
            var ctx = c.getContext("2d");
            ctx.font = "10px Arial";

            var contestEndsText = $translate.instant("CONTEST_ENDS_IN", {
                "number": 3,
                "units": $translate.instant("DEMO_CONTEST_ENDS_IN_UNITS")
            });
            var contestEndsWidth = ctx.measureText(contestEndsText).width;
            var contestParticipantsText = $translate.instant("CONTEST_PARTICIPANTS", {"participants": 45});
            var contestParticipantsWidth = ctx.measureText(contestParticipantsText).width;
            ctx.font = "12px Arial";

            return {
                "contestEndsText": contestEndsText,
                "contestEndsWidth": contestEndsWidth,
                "contestParticipantsText": contestParticipantsText,
                "contestParticipantsWidth": contestParticipantsWidth
            }
        }

        $rootScope.$on('mySmarteam-languageChanged', function (e, rejection) {
            refreshDemoContest();
        });

        var contestAnnotations = getDemoContestAnnotations();
        $scope.demoContest =
        {
            chart: {
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
                "chartBottomMargin": 30,
                "showToolTip": 0
            },
            data: [
                {
                    "value": "0.45"

                },
                {
                    "value": "0.55"
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
                                "y": "$chartendy - 8",
                                "fontSize": 10,
                                "font": "Arial",
                                "fontColor": "#FF0000"
                            },
                            {
                                "id": "label",
                                "type": "text",
                                "y": "$chartendy - 8",
                                "fontSize": 10,
                                "font": "Arial",
                                "fontColor": "#FF0000"
                            }
                        ]
                    }
                ]
            },
        };
        refreshDemoContest();

        function refreshDemoContest() {
            var contestAnnotations = getDemoContestAnnotations();
            $scope.demoContest.chart.caption = $translate.instant("WHO_IS_SMARTER");
            $scope.demoContest.chart.subCaption = $translate.instant("CONTEST_NAME", {
                "team0": $translate.instant("DEMO_TEAM0"),
                "team1": $translate.instant("DEMO_TEAM1")
            });

            $scope.demoContest.data[0].label = $translate.instant("DEMO_TEAM0");
            ;
            $scope.demoContest.data[1].label = $translate.instant("DEMO_TEAM1");

            $scope.demoContest.annotations.groups[0].items[0].text = contestAnnotations.contestEndsText;
            $scope.demoContest.annotations.groups[0].items[1].text = contestAnnotations.contestParticipantsText;

            if ($rootScope.languages[$rootScope.user.settings.language].direction == "ltr") {
                //ltr
                $scope.demoContest.annotations.groups[0].items[0].x = "$chartstartx + " + (contestAnnotations.contestEndsWidth / 2 + 3);
                $scope.demoContest.annotations.groups[0].items[1].x = "$chartendx - " + (contestAnnotations.contestParticipantsWidth / 2 + 3);
            }
            else {
                //rtl
                $scope.demoContest.annotations.groups[0].items[0].x = "$chartendx - " + (contestAnnotations.contestEndsWidth / 2 + 3);
                $scope.demoContest.annotations.groups[0].items[1].x = "$chartstartx + " + (contestAnnotations.contestParticipantsWidth / 2 + 3);
            }
        }

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
        };
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
                        "chartBottomMargin": 30,
                        "useroundedges": "1",
                        "showToolTip": 0
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
                        "useroundedges": "1",
                        "showToolTip": 0
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
            },
            "annotationClick": function (eventObj, dataObj) {
                console.log("Annotation Click");
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

    .controller('SettingsCtrl', function ($scope, $rootScope, $ionicPopover, $ionicSideMenuDelegate, UserService, ErrorService, $translate, $ionicHistory) {

        //Clone the user settings from the root object - all screen changes will work on the local cloned object
        //only "Apply" button will send the changes to the server
        $scope.$on('$ionicView.beforeEnter', function () {
            $scope.localViewData = JSON.parse(JSON.stringify($rootScope.session.settings));
            //A bug - if putting "menu-close" in menu.html - back button won't show - have to close the menu programatically
            if ($rootScope.languages[$rootScope.session.settings.language].direction == "ltr") {
                $ionicSideMenuDelegate.toggleLeft();
            }
            else {
                $ionicSideMenuDelegate.toggleRight();
            }
            $ionicSideMenuDelegate.canDragContent(false);
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

    .controller('ContestCtrl', function ($scope, $rootScope, $state, $ionicHistory, $translate, $stateParams) {

        var startDate = new Date();
        var endDate = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);

        var datePickerToday  = $translate.instant("DATE_PICKER_TODAY");
        var datePickerClose = $translate.instant("DATE_PICKER_CLOSE");
        var datePickerSet = $translate.instant("DATE_PICKER_SET");
        var datePickerErrorMessage = $translate.instant("DATE_PICKER_ERROR_MESSAGE");
        var datePickerWeekDays = $translate.instant("DATE_PICKER_WEEK_DAYS").split(",");
        var datePickerMonths = $translate.instant("DATE_PICKER_MONTHS").split(",");

        $scope.contestStartDatePicker = {
            titleLabel: $translate.instant("CONTEST_START"),
            todayLabel: datePickerToday,
            closeLabel: datePickerClose,
            setLabel: datePickerSet,
            errorMsgLabel: datePickerErrorMessage,
            setButtonType: 'button-assertive',
            mondayFirst: false,
            weekDaysList: datePickerWeekDays,
            monthList: datePickerMonths,
            templateType: 'popup',
            modalHeaderColor: 'bar-positive',
            modalFooterColor: 'bar-positive',
            from: new Date(), //do not allow past dates
            callback: startDateCallback
        };

        $scope.contestEndDatePicker = {
            titleLabel: $translate.instant("CONTEST_END"),
            todayLabel: datePickerToday,
            closeLabel: datePickerClose,
            setLabel: datePickerSet,
            errorMsgLabel: datePickerErrorMessage,
            setButtonType: 'button-assertive',
            mondayFirst: false,
            weekDaysList: datePickerWeekDays,
            monthList: datePickerMonths,
            templateType: 'popup',
            modalHeaderColor: 'bar-positive',
            modalFooterColor: 'bar-positive',
            from: new Date(), //do not allow past dates
            callback: endDateCallback
        };

        $scope.$on('$ionicView.beforeEnter', function () {
            if ($stateParams.mode) {
                $scope.mode = $stateParams.mode;
                if ($stateParams.mode == "edit") {
                    if ($stateParams.contest) {
                        $scope.localViewData = JSON.parse(JSON.stringify($stateParams.contest));
                    }
                    else {
                        $scope.goBack();
                        return;
                    }
                }
                else {
                    //Copy data from first profile, and then clear the
                    var startDate = new Date();
                    var endDate = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);
                    $scope.localViewData = {
                        "startDate": startDate,
                        "endDate": endDate,
                        "participants" : 22,
                        "manualParticipants": 0,
                        "manualRating": 0,
                        "teams": [{"name": null, "score": 0}, {"name": null, "score": 0}]
                    };
                    $scope.localViewData.totalParticipants = $scope.localViewData.participants + $scope.localViewData.manualParticipants;
                }
            }
            else {
                $scope.goBack();
                return;
            }

            $scope.showAdminInfo = false;

            //Bug - currently not working - issue opened
            $scope.contestStartDatePicker.inputDate = startDate;
            $scope.contestStartDatePicker.inputDate = endDate;
        });

        $scope.toggleAdminInfo = function() {
            if ($scope.localViewData.teams[0].name && $scope.localViewData.teams[1].name) {
                $scope.showAdminInfo = !$scope.showAdminInfo;
            }
        };

        $scope.getAdminArrowSign = function () {
            if ($rootScope.languages[$rootScope.session.settings.language].direction == "ltr") {
                if ($scope.showAdminInfo == false) {
                    return "►";
                }
                else {
                    return "▼";
                }
            }
            else {
                if ($scope.showAdminInfo == false) {
                    return "◄";
                }
                else {
                    return "▼";
                }
            }
        };

        $scope.goBack = function () {
            $ionicHistory.goBack();
        }

        $scope.getTitle = function () {
            if ($stateParams.mode == "add") {
                return $translate.instant("NEW_CONTEST") + " - " + $translate.instant("WHO_IS_SMARTER");
            }
            else if ($stateParams.mode == "edit") {
                return $translate.instant("WHO_IS_SMARTER") + ": " + $translate.instant("CONTEST_NAME", {
                        "team0": $stateParams.contest.teams[0].name,
                        "team1": $stateParams.contest.teams[1].name
                    });
            }
            else {
                return null;
            }
        };

        function startDateCallback(val) {
            if (val) {
                $scope.localViewData.startDate = val;
            }
        }

        function endDateCallback(val) {
            if (val) {
                $scope.localViewData.endDate = val;
            }
        }

        $scope.hideRemoveContest = function () {
            if ($stateParams.mode == 'add' || !$rootScope.session.isAdmin || $rootScope.session.isAdmin == false) {
                return true;
            }
            else {
                return false;
            }
        }

    })
