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
                    template: "<span dir='" + $rootScope.settings.languages[$rootScope.user.settings.language].direction + "'>" + $translate.instant("LOADING") + "</span>"
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

        $rootScope.gotoView = function (viewName, params) {
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

            $scope.demoContest.data[1].label = $translate.instant("DEMO_TEAM1");

            $scope.demoContest.annotations.groups[0].items[0].text = contestAnnotations.contestEndsText;
            $scope.demoContest.annotations.groups[0].items[1].text = contestAnnotations.contestParticipantsText;

            if ($rootScope.settings.languages[$rootScope.user.settings.language].direction == "ltr") {
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

    .controller('ContestsCtrl', function ($scope, $state, $rootScope, $ionicHistory, $translate, ContestsService, ErrorService, $ionicGesture) {

        var contestCaption = $translate.instant("WHO_IS_SMARTER");
        var canvas = document.getElementById("myCanvas");
        var canvasContext = canvas.getContext("2d");
        canvasContext.font = $rootScope.settings.chartSettings.generalData.annotationsFont;

        $scope.hasMoreContests = false;
        $scope.loadMoreContests = function () {
            console.log("load more contests...");
        }

        $scope.doRefresh = function () {

            ContestsService.getContests(null, function (contests) {
                    var contestCharts = {};
                    for (var key in contests) {
                        if (contests.hasOwnProperty(key)) {
                            var contestChart = prepareContestChart(contests[key]);
                            contestCharts[key] = contestChart;
                        }
                    }

                    $scope.contestCharts = contestCharts;

                }, ErrorService.logErrorAndAlert
            )
            $scope.$broadcast('scroll.refreshComplete');
        }

        $scope.$on('$ionicView.beforeEnter', function () {
            if (!$rootScope.session) {
                $ionicHistory.nextViewOptions({
                    disableBack: true
                });
                $state.go('app.home', {}, {reload: false, inherit: true});
            }
        });

        $scope.playContest = function (contestId) {
            $state.go('app.quiz', {contestId: contestId}, {reload: false, inherit: true});
        }

        $scope.fcEvents = {
            "dataplotClick": function (eventObj, dataObj) {
                teamClicked(eventObj.sender.args.dataSource, dataObj.dataIndex);
            },
            "dataLabelClick": function (eventObj, dataObj) {
                teamClicked(eventObj.sender.args.dataSource, dataObj.dataIndex);
            },
            "annotationClick": function (eventObj, dataObj) {
                $state.go('app.contest', {mode: "edit", contest: eventObj.sender.args.dataSource.contest}, {
                    reload: false,
                    inherit: true
                });
            }
        }

        function prepareContestChart(contest) {
            var contestChart = JSON.parse(JSON.stringify($rootScope.settings.chartSettings.chartObject));
            contestChart.contest = contest;

            contestChart.data = [];
            var teamsOrder;
            if ($rootScope.settings.languages[$rootScope.session.settings.language].direction == "ltr") {
                teamsOrder = [0, 1];
            }
            else {
                teamsOrder = [1, 0];
            }
            contestChart.data.push({
                "label": contest.teams[teamsOrder[0]].name,
                "value": contest.teams[teamsOrder[0]].chartValue
            });
            contestChart.data.push({
                "label": contest.teams[teamsOrder[1]].name,
                "value": contest.teams[teamsOrder[1]].chartValue
            });

            if (typeof(contest.myTeam) == "undefined") {
                contestChart.chart.paletteColors = $rootScope.settings.chartSettings.generalData.defaultPaletteColors;
            }
            else {
                contestChart.chart.paletteColors = $rootScope.settings.chartSettings.generalData.teamPaletteColors[teamsOrder[contest.myTeam]];
            }

            contestChart.chart.caption = contestCaption;
            contestChart.chart.subCaption = $translate.instant("CONTEST_NAME", {
                team0: contest.teams[0].name,
                team1: contest.teams[1].name
            });

            var contestEndsString = $translate.instant("CONTEST_ENDS_IN", {
                number: contest.endsInNumber,
                units: $translate.instant(contest.endsInUnits)
            });

            var contestEndsWidth = canvasContext.measureText(contestEndsString).width;
            var contestParticipantsString = $translate.instant("CONTEST_PARTICIPANTS", {participants: contest.participants + contest.manualParticipants});
            var contestParticipantsWidth = canvasContext.measureText(contestParticipantsString).width;

            contestChart.annotations.groups[0].items[0].text = contestEndsString;
            contestChart.annotations.groups[0].items[0].x = "$chartendx - " + (contestEndsWidth / 2 + $rootScope.settings.chartSettings.generalData.annotationHorizontalMagicNumber);

            contestChart.annotations.groups[0].items[1].text = contestParticipantsString;
            contestChart.annotations.groups[0].items[1].x = "$chartstartx + " + (contestParticipantsWidth / 2 + $rootScope.settings.chartSettings.generalData.annotationHorizontalMagicNumber);

            return contestChart;
        }

        function teamClicked(dataSource, teamId) {
            var serverTeamId = teamId;
            if ($rootScope.settings.languages[$rootScope.session.settings.language].direction == "rtl") {
                serverTeamId = 1 - teamId; //In RTL - the teams are presented backwards
            }

            var postData = {"contestId": dataSource.contest._id, "teamId": serverTeamId};
            ContestsService.joinContest(postData,
                function (contest) {
                    $scope.contestCharts[contest._id] = prepareContestChart(contest);
                    $scope.contestCharts[contest._id].contest = contest;
                }, ErrorService.logErrorAndAlert)
        }

        $scope.$on('$ionicView.beforeEnter', function () {
            $scope.doRefresh();
        });
    })

    .controller('QuizCtrl', function ($scope, $rootScope, $state, $stateParams, UserService, QuizService, ErrorService, $ionicHistory, $translate) {

        $scope.$on('$ionicView.beforeEnter', function () {

            QuizService.start({"contestId": $stateParams.contestId},
                function (data) {
                    $scope.quiz = data;
                    $scope.quiz.currentQuestion.answered = false;
                },
                function (status, error) {
                    ErrorService.logErrorAndAlert(status, error).then($ionicHistory.goBack());
                });
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
            if ($rootScope.settings.languages[$rootScope.session.settings.language].direction == "ltr") {
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

    .controller('ContestCtrl', function ($scope, $rootScope, $state, $ionicHistory, $translate, $stateParams, ContestsService, ErrorService, $ionicPopup) {

        var startDate = new Date();
        var endDate = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);

        var datePickerToday = $translate.instant("DATE_PICKER_TODAY");
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
                        //Server stores in epoch - client uses real DATE objects
                        $scope.localViewData.startDate = new Date($scope.localViewData.startDate);
                        $scope.localViewData.endDate = new Date($scope.localViewData.endDate);

                        if ($scope.localViewData.status == "running" && $scope.localViewData.participants > 0) {
                            $scope.showStartDate = false;
                        }
                        else {
                            $scope.showStartDate = true;
                        }
                    }
                    else {
                        $scope.goBack();
                        return;
                    }
                }
                else {
                    //Copy data from first profile, and then clear the
                    $scope.localViewData = {
                        "startDate": startDate,
                        "endDate": endDate,
                        "participants": 0,
                        "manualParticipants": 0,
                        "manualRating": 0,
                        "teams": [{"name": null, "score": 0}, {"name": null, "score": 0}]
                    };

                    $scope.showStartDate = true;
                }
            }
            else {
                $scope.goBack();
                return;
            }

            console.log($scope.showStartDate);
            $scope.localViewData.totalParticipants = $scope.localViewData.participants + $scope.localViewData.manualParticipants;
            $scope.showAdminInfo = false;

            //Bug - currently not working - issue opened
            $scope.contestStartDatePicker.inputDate = startDate;
            $scope.contestStartDatePicker.inputDate = endDate;

        });

        $scope.toggleAdminInfo = function () {
            if ($scope.localViewData.teams[0].name && $scope.localViewData.teams[1].name) {
                $scope.showAdminInfo = !$scope.showAdminInfo;
            }
        };

        $scope.getAdminArrowSign = function () {
            if ($rootScope.settings.languages[$rootScope.session.settings.language].direction == "ltr") {
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
                return $translate.instant("WHO_IS_SMARTER");
            }
            else {
                return null;
            }
        };

        function startDateCallback(val) {
            if (val) {
                if (val <= $scope.localViewData.endDate) {
                    $scope.localViewData.startDate = val;
                }
            }
        }

        function endDateCallback(val) {
            if (val) {
                if (val >= $scope.localViewData.startDate) {
                    //Date picker works with time as 00:00:00.000
                    //End date should be "almost" midnight of the selected date, e.g. 23:59:59.000
                    $scope.localViewData.endDate = new Date(val.getTime() + (24 * 60 * 60 - 1) * 1000);
                }
            }
        }

        $scope.setContest = function () {

            //Tweak the manual participants
            if ($scope.localViewData.totalParticipants > $scope.localViewData.participants + $scope.localViewData.manualParticipants) {
                $scope.localViewData.manualParticipants += $scope.localViewData.totalParticipants - ($scope.localViewData.participants + $scope.localViewData.manualParticipants)
            }

            delete $scope.localViewData["totalParticipants"];

            delete $scope.localViewData["status"];

            //Server stores in epoch - client uses real DATE objects
            //Convert back to epoch before storing to server
            $scope.localViewData.startDate = $scope.localViewData.startDate.getTime();
            $scope.localViewData.endDate = $scope.localViewData.endDate.getTime();

            if ($stateParams.mode == "add" || ($stateParams.mode == "edit" && JSON.stringify($stateParams.contest) != JSON.stringify($scope.localViewData))) {

                var postData = {"contest": $scope.localViewData, "mode": $stateParams.mode};

                //Add/update the new/updated contest to the server and in the local $rootScope
                ContestsService.setContest(postData,
                    function (contest) {
                        //Raise event - so the contest graph can be refreshed without going to the server again
                        $rootScope.$broadcast("mySmarteam-contestUpdated", contest);
                        $scope.goBack();
                    }, function (status, error) {
                        console.log(error);
                    });
            }
            else {
                $scope.goBack();
            }
        };

        $scope.removeContest = function () {

            var contestName = $translate.instant("CONTEST_NAME", {
                team0: $scope.localViewData.teams[0].name,
                team1: $scope.localViewData.teams[1].name
            });
            var confirmPopup = $ionicPopup.confirm({
                title: $translate.instant("CONFIRM_REMOVE_TITLE", {name: contestName}),
                template: $translate.instant("CONFIRM_REMOVE_TEMPLATE", {name: contestName}),
                cssClass: $rootScope.settings.languages[$rootScope.session.settings.language].direction,
                okText: $translate.instant("OK"),
                cancelText: $translate.instant("CANCEL")
            });

            confirmPopup.then(function (res) {
                if (res) {
                    var postData = {"contestId": $scope.localViewData._id};
                    ContestsService.removeContest(postData,
                        function (data) {
                            $rootScope.$broadcast("mySmarteam-contestRemoved");
                            $scope.goBack();
                        }, ErrorService.logErrorAndAlert)
                }
            })
        };

        $scope.hideRemoveContest = function () {
            if ($stateParams.mode == 'add' || !$rootScope.session.isAdmin || $rootScope.session.isAdmin == false) {
                return true;
            }
            else {
                return false;
            }
        }

    })
