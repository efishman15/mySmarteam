angular.module('mySmarteam.controllers', ['mySmarteam.services', 'ngAnimate'])

    .controller('AppCtrl', function ($scope, $rootScope, $ionicSideMenuDelegate) {
    })

    .controller('HomeCtrl', function ($scope, $rootScope, $state, UserService, ErrorService, $ionicHistory, $ionicPopup, $translate, $window) {

        $scope.$on('$ionicView.beforeEnter', function () {

            if ($rootScope.session) {
                $rootScope.gotoView("tabs.contests.mine");
            }
            else if (!$rootScope.user) {
                UserService.initUser();
            }
        });

        $scope.changeLanguage = function (language) {
            $rootScope.user.settings.language = language.value;
            $translate.use(language.value);
        };

        $scope.getDemoContestWidth = function () {
            var width = $window.innerWidth;
            var height = $window.innerHeight;

            if (height > width) {
                //Portrait
                if (width > 1024) {
                    return "400px";
                }
                else {
                    return "75%"
                }
            }
            else {
                //Landscape
                if (width < 400) {
                    return width + "px";
                }
                else {
                    return "400px";
                }
            }
        };

        $scope.$on("mySmarteam-windowResize", function () {
            angular.element(document.querySelector("#demoContestImage")).width = $scope.getDemoContestWidth();
        });

        $scope.$on("mySmarteam-orientationChanged", function () {
            angular.element(document.querySelector("#demoContestImage")).width = $scope.getDemoContestWidth();
        });

        $scope.facebookConnect = function () {
            UserService.facebookClientConnect(function (session) {
                $rootScope.gotoView("tabs.contests.mine");
            })
        };

    })

    .controller('ContestsCtrl', function ($scope, $state, $rootScope, $ionicHistory, $translate, ContestsService, ErrorService, $timeout, ChartService) {

        var shouldTriggerScrollInfiniteRealFunction = false; //handling ionic bug regarding scroll infinite called twice

        $scope.$on('$ionicView.beforeEnter', function () {
            if (!$rootScope.session) {
                $rootScope.gotoView("home");
                return;
            }

            $scope.doRefresh();
        });

        $scope.doRefresh = function () {

            if ($scope.contestCharts) {
                $scope.contestCharts.length = 0;
            }

            $scope.totalContests = 0;

            //That bug again...prevent inifinite firing twice
            shouldTriggerScrollInfiniteRealFunction = false;

            $scope.loadMoreContests(true);
        };

        $scope.showPlay = function() {
            return ($state.current.appData && $state.current.appData.showPlay);
        };

        $scope.showContestParticipants = function() {
            return ($state.current.appData && $state.current.appData.showParticipants);
        };

        $scope.haveMoreContests = function () {
            return ($scope.totalContests == -1 || //never retrieved from the server
            ($scope.totalContests > 0 && $scope.contestCharts.length < $scope.totalContests)); //retrieved, server has data, and I have less than the server
        };

        $scope.showParticipants = function() {
            ErrorService.alert("TBD");
        }

        $scope.infiniteLoadMoreContests = function () {
            $timeout(function() {
                if (shouldTriggerScrollInfiniteRealFunction == false) {  //let the first time triggers this code that does nothing but completing the buggy first infinite scroll triggering
                    shouldTriggerScrollInfiniteRealFunction = true; // set the boolean to true so that the real load function is called next time infinite scrolling triggers
                    $scope.$broadcast('scroll.infiniteScrollComplete');
                }
                else {  // here it will be the real need for scrolling
                    $scope.loadMoreContests();
                }
            },100);
        };

        $scope.loadMoreContests = function (fullRefresh) {

            var clientContestCount;

            if ($scope.contestCharts) {
                clientContestCount = $scope.contestCharts.length;
            }
            else {
                clientContestCount = 0;
            }

            var postData = {"clientContestCount": clientContestCount, "tab": $state.current.appData.serverTab};

            var config;
            if ($scope.totalContests != -1) {
                config = {"blockUserInterface" : false}
            }

            ContestsService.getContests(postData, function (contestsResult) {
                    $scope.totalContests = contestsResult.count;

                    if (!$scope.contestCharts) {
                        $scope.contestCharts = [];
                    }

                    //Add server contests to the end of the array
                    var contestChartsCount = $scope.contestCharts.length;

                    for (var i = 0; i < contestsResult.list.length; i++) {
                        var contestChart = ContestsService.prepareContestChart(contestsResult.list[i], contestChartsCount + i);
                        $scope.contestCharts.push(contestChart);
                    }

                    $scope.$broadcast('scroll.infiniteScrollComplete');

                    if (fullRefresh == true) {
                        $scope.$broadcast('scroll.refreshComplete');
                    }
                }, null, config);
        }

        $scope.playContest = function (contest) {
            if (contest.myTeam == 0 || contest.myTeam == 1) {
                $rootScope.gotoView("quiz", false, {contestId: contest._id});
            }
            else {
                ErrorService.alert({"type": "SERVER_ERROR_NOT_JOINED_TO_CONTEST"});
            }
        };

        ChartService.setEvents($scope);
    })

    .controller('QuizCtrl', function ($scope, $rootScope, $state, $stateParams, UserService, QuizService, ErrorService, $ionicHistory, $translate, $timeout, SoundService) {

        $scope.hideTabs = true;

        $scope.$on('$ionicView.beforeEnter', function (event, viewData) {

            viewData.enableBack = true;
            startQuiz();

        });

        function startQuiz() {

            if (!$stateParams.contestId) {
                $rootScope.gotoView("tabs.contests.mine");
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
        }

        $scope.nextQuestion = function() {
            QuizService.nextQuestion({"questionId" : $scope.quiz.currentQuestion.id},
                function (data) {
                    $scope.quiz = data;
                    $scope.quiz.currentQuestion.answered = false;
                });
        }

        $scope.buttonAnimationEnded = function (button, event) {

            if ($scope.correctButtonId == button.id) {
                if ($scope.quiz.finished == true) {
                    $rootScope.session.score += $scope.quiz.results.score;
                    $rootScope.gotoView('quizResult', true, {results: $scope.quiz.results}, false);
                }
                else {
                    $scope.nextQuestion();
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

            var config = {"onServerErrors" : {
                "SERVER_ERROR_SESSION_EXPIRED_DURING_QUIZ": {"next": startQuiz},
                "SERVER_ERROR_GENERAL": {"next": function() {$ionicHistory.goBack();}}
            }};

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
                }, null, config);
        }
    })

    .controller('QuizResultCtrl', function ($scope, $rootScope, $stateParams, $state, $translate, $ionicHistory, ContestsService, SoundService, ChartService) {

        if (!$scope.contestCharts) {
            $scope.contestCharts = [{}];
        }

        $scope.$on('$ionicView.beforeEnter', function () {

            if (!$stateParams.results) {
                $rootScope.gotoView("tabs.contests.mine");
                return;
            }

            $scope.results = $stateParams.results;

            //Work with an array becase ChartService.setEvents works with an array scope property called contestCharts
            $scope.contestCharts = [ContestsService.prepareContestChart($scope.results.contest, 0)];

            //Play sound only if enabled and not came by pressing back
            if ($rootScope.session.settings.sound == true && (!$rootScope.lastPlayed || $rootScope.lastPlayed < $stateParams.results.contest.lastPlayed)) {
                SoundService.play($scope.results.sound);
            }

            $rootScope.lastPlayed = $stateParams.results.contest.lastPlayed;
        });

        $scope.playAgain = function () {

            $rootScope.gotoView('quiz', false, {
                contestId: $scope.results.contest._id,
                teamId: $scope.results.contest.myTeam
            });

        };

        ChartService.setEvents($scope);

    })

    .controller('LogoutCtrl', function ($scope, $rootScope, $state, UserService, ErrorService, $ionicHistory, $translate) {

        $scope.$on('$ionicView.beforeEnter', function () {
            UserService.logout(function () {
                $translate.use($rootScope.user.settings.language);
                $rootScope.gotoView("home");
            });
        });
    })

    .controller('SettingsCtrl', function ($scope, $rootScope, $ionicPopover, $ionicSideMenuDelegate, UserService, ErrorService, $translate) {

        //Clone the user settings from the root object - all screen changes will work on the local cloned object
        //only "Apply" button will send the changes to the server
        $scope.$on('$ionicView.beforeEnter', function (event, viewData) {
            $scope.localViewData = JSON.parse(JSON.stringify($rootScope.session.settings));
            //A bug - if putting "menu-close" in menu.html - back button won't show - have to close the menu programatically
            if ($rootScope.settings.languages[$rootScope.session.settings.language].direction == "ltr") {
                $ionicSideMenuDelegate.toggleLeft();
            }
            else {
                $ionicSideMenuDelegate.toggleRight();
            }
            $ionicSideMenuDelegate.canDragContent(false);

            viewData.enableBack = true;

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
                $rootScope.gotoView("tabs.contests.mine");
            }
            else {
                $rootScope.gotoView("home");
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
            //from: new Date(), //do not allow past dates
            callback: endDateCallback
        };

        if (!$rootScope.session.isAdmin || !$rootScope.session.isAdmin === false) {
            //Only Admins are allowed to set past dates
            $scope.contestStartDatePicker.from = startDate;
            $scope.contestStartDatePicker.from = startDate;
        }
        else {
            var pastDate = new Date(1970,0,1);
            $scope.contestStartDatePicker.from = pastDate;
            $scope.contestStartDatePicker.from = pastDate;
        }

        $scope.$on('$ionicView.beforeEnter', function (event, viewData) {
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
                $rootScope.gotoView("tabs.contests.mine");
                return;
            }

            viewData.enableBack = true;

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
            if ($stateParams.mode == 'add' || !$rootScope.session.isAdmin || $rootScope.session.isAdmin === false) {
                return true;
            }
            else {
                return false;
            }
        }

    });
