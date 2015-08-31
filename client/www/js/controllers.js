angular.module('mySmarteam.controllers', ['mySmarteam.services', 'ngAnimate'])

    .controller('AppCtrl', function ($scope, $rootScope, $state, $ionicLoading, UserService, ErrorService, MyAuthService, authService, InfoService, $translate, $ionicHistory) {

        $rootScope.$on('$translateChangeEnd', function (data) {
            $rootScope.$broadcast("mySmarteam-languageChanged");
        });

        $rootScope.$on("mySmarteam-httpRequest", function () {
            $ionicLoading.show({
                    template: "<span dir='" + $rootScope.settings.languages[$rootScope.user.settings.language].direction + "'>" + $translate.instant("LOADING") + "</span>"
                }
            )
        });

        $rootScope.$on("mySmarteam-httpResponse", function () {
            $ionicLoading.hide();
        });

        $rootScope.$on("mySmarteam-httpResponseError", function (error, errorData) {
            $ionicLoading.hide();
            if (errorData instanceof Object && errorData.type) {
                ErrorService.alert(errorData)
            }
        });

        $rootScope.$on("event:auth-loginRequired", function (e, rejection) {
                UserService.getLoginStatus(function (success) {
                        UserService.facebookServerConnect(
                            function (data) {
                                authService.loginConfirmed(null, function (config) {
                                    return MyAuthService.confirmLogin(data.token, config);
                                });
                            },
                            function (status, error) {
                                $rootScope.gotoView("app.home");
                            }
                        )
                    },
                    function (error) {
                        $rootScope.gotoView("app.home");
                    });
            }
        );

        $rootScope.gotoView = function (viewName, isRootView, params) {
            if (isRootView == null) {
                isRootView = true;
            }

            if (!params) {
                params = {};
            }

            if (isRootView == true) {
                $ionicHistory.clearHistory();
                $ionicHistory.nextViewOptions({
                    disableBack: true,
                    historyRoot: true
                });
            }

            $state.go(viewName, params, {reload: true, inherit: true});

        };
    })

    .controller('HomeCtrl', function ($scope, $rootScope, $state, UserService, ErrorService, $ionicHistory, $ionicPopup, $translate, ContestsService) {

        $scope.$on('$ionicView.beforeEnter', function () {
            if ($rootScope.session) {
                $rootScope.gotoView("app.contests");
            }
            else if (!$rootScope.user) {
                UserService.initUser();
            }
        });

        $scope.changeLanguage = function (language) {
            $rootScope.user.settings.language = language.value;
            $translate.use(language.value);
        };

        $scope.facebookConnect = function () {
            UserService.facebookClientConnect(function (session) {
                $rootScope.gotoView("app.contests");
            })
        };

    })

    .controller('ContestsCtrl', function ($scope, $state, $rootScope, $ionicHistory, $translate, ContestsService, ErrorService, $timeout) {

        $scope.hasMoreContests = false;
        $scope.loadMoreContests = function () {
            console.log("load more contests...");
        }

        $scope.doRefresh = function () {

            ContestsService.getContests(null, function (contests) {
                    var contestCharts = {};
                    for (var key in contests) {
                        if (contests.hasOwnProperty(key)) {
                            var contestChart = ContestsService.prepareContestChart(contests[key]);
                            contestCharts[key] = contestChart;
                        }
                    }

                    $scope.contestCharts = contestCharts;
                }
            );

            $scope.$broadcast('scroll.refreshComplete');
        }

        $scope.$on('$ionicView.beforeEnter', function () {
            if (!$rootScope.session) {
                $rootScope.gotoView("app.home");
            }
        });

        $scope.playContest = function (contest) {
            if (contest.myTeam == 0 || contest.myTeam == 1) {
                $rootScope.gotoView("app.quiz", false, {contestId: contest._id});
            }
            else {
                ErrorService.alert({"type" : "SERVER_ERROR_NOT_JOINED_TO_CONTEST"});
            }
        };

        $scope.fcEvents = {
            "dataplotClick": function (eventObj, dataObj) {
                teamClicked(eventObj.sender.args.dataSource, dataObj.dataIndex);
            },
            "dataLabelClick": function (eventObj, dataObj) {
                teamClicked(eventObj.sender.args.dataSource, dataObj.dataIndex);
            },
            "annotationClick": function (eventObj, dataObj) {
                $rootScope.gotoView("app.contest", false, {mode: "edit", contest: eventObj.sender.args.dataSource.contest});
            }
        };

        function teamClicked(dataSource, teamId) {
            var serverTeamId = teamId;
            if ($rootScope.settings.languages[$rootScope.session.settings.language].direction == "rtl") {
                serverTeamId = 1 - teamId; //In RTL - the teams are presented backwards
            }

            //Show effect of joining the team on the client side before entering the quiz
            if (dataSource.contest.myTeam == null || dataSource.contest.myTeam != serverTeamId) {
                dataSource.contest.myTeam = serverTeamId;

                $scope.$apply(function() {
                    $scope.contestCharts[dataSource.contest._id] = ContestsService.prepareContestChart(dataSource.contest);
                })

                $timeout(function() {
                    $rootScope.gotoView("app.quiz", false, {contestId: dataSource.contest._id, teamId: serverTeamId});
                },1500);
            }
            else {
                $rootScope.gotoView("app.quiz", false, {contestId : dataSource.contest._id, teamId: serverTeamId});
            }
        }

        $scope.$on('$ionicView.beforeEnter', function () {
            $scope.doRefresh();
        });
    })

    .controller('QuizCtrl', function ($scope, $rootScope, $state, $stateParams, UserService, QuizService, ErrorService, $ionicHistory, $translate, $timeout, SoundService) {

        $scope.$on('$ionicView.beforeEnter', function () {

            if (!$stateParams.contestId) {
                $rootScope.gotoView("app.contests");
                return;
            }

            var postData = {"contestId": $stateParams.contestId};
            if ($stateParams.teamId == 0 || $stateParams.teamId == 1) {
                postData.teamId = $stateParams.teamId;
            }

            QuizService.start(postData,
                function (data) {
                    $scope.quiz = data;
                    $scope.quiz.currentQuestion.answered = false;
                });
        });

        function getNextQuestion() {
            QuizService.nextQuestion(
                function (data) {
                    $scope.quiz = data;
                    $scope.quiz.currentQuestion.answered = false;
                });
        }

        $scope.buttonAnimationEnded = function (button, event) {

            if ($scope.correctButtonId == button.id) {
                if ($scope.quiz.finished == true) {
                    $rootScope.session.score += $scope.quiz.results.score;
                    $rootScope.gotoView('app.quizResult', false, {results: $scope.quiz.results});
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
                });
        };

        $scope.submitAnswer = function (answerId) {
            $scope.quiz.currentQuestion.answered = true;
            QuizService.answer({"id": answerId},
                function (data) {
                    var correctAnswerId;

                    if (data.results) {
                        //Will get here when quiz is finished
                        $scope.quiz.results = data.results;
                    }

                    if (data.question.correct == true) {
                        correctAnswerId = answerId;
                        $scope.quiz.currentQuestion.answers[answerId - 1].answeredCorrectly = true;
                        if ($rootScope.session.settings.sound == true) {
                            SoundService.play("audio/click_ok");
                        }
                    }
                    else {
                        if ($rootScope.session.settings.sound == true) {
                            SoundService.play("audio/click_wrong");
                        }
                        correctAnswerId = data.question.correctAnswerId;
                        $scope.quiz.currentQuestion.answers[answerId - 1].answeredCorrectly = false;
                        $timeout(function () {
                            $scope.$apply(function () {
                                $scope.quiz.currentQuestion.answers[data.question.correctAnswerId - 1].correct = true;
                            })
                        }, 3000);
                    }

                    $scope.correctButtonId = "buttonAnswer" + correctAnswerId;
                });
        }
    })

    .controller('QuizResultCtrl', function ($scope, $rootScope, $stateParams, $state, $translate, $ionicHistory, ContestsService, SoundService) {

        $scope.chart = {};

        $scope.$on('$ionicView.beforeEnter', function () {

            if (!$stateParams.results) {
                $rootScope.gotoView("app.contests");
                return;
            }

            $scope.results = $stateParams.results;

            $scope.chart = ContestsService.prepareContestChart($scope.results.contest);

            if ($rootScope.session.settings.sound == true) {
                SoundService.play($scope.results.sound);
            }
        });

        $scope.playAgain = function() {
            $rootScope.gotoView('app.quiz', false, {contestId: $scope.results.contest._id, teamId : $scope.results.contest.myTeam} )
        };
    })

    .controller('LogoutCtrl', function ($scope, $rootScope, $state, UserService, ErrorService, $ionicHistory, $translate) {
        $scope.$on('$ionicView.beforeEnter', function () {
            UserService.logout(function () {
                    $translate.use($rootScope.user.settings.language);
                    $rootScope.gotoView("app.home");
                });
        });
    })

    .controller('SettingsCtrl', function ($scope, $rootScope, $ionicPopover, $ionicSideMenuDelegate, UserService, ErrorService, $translate) {

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
                    });
            }
        });
    })

    .controller('OtherwiseCtrl', function ($scope, $rootScope, $state) {
        $scope.$on('$ionicView.beforeEnter', function () {
            if ($rootScope.session || ($rootScope.user && $rootScope.user.thirdParty)) {
                $rootScope.gotoView("app.contests");
            }
            else {
                $rootScope.gotoView("app.home");
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
                        });
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

    });
