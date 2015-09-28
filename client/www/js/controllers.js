angular.module('whoSmarter.controllers', ['whoSmarter.services', 'ngAnimate'])

    .controller("AppCtrl", function ($scope, $rootScope, XpService, $ionicSideMenuDelegate, PopupService, SoundService, $ionicModal, StoreService) {

        $rootScope.$on('whoSmarter-directionChanged', function () {
            $scope.canvas.className = "menu-xp-" + $rootScope.settings.languages[$rootScope.user.settings.language].direction;
        });

        $scope.$on("whoSmarter-windowResize", function () {
            resizeCanvas();
        });

        function resizeCanvas() {

            var CANVAS_WIDTH = 640;

            if ($rootScope.user.clientInfo.platform !== "facebook") {
                return;
            }

            var containerWidth = window.innerWidth;

            var hostingView = document.getElementById("myHostingView");
            if (hostingView) {

                if (containerWidth > CANVAS_WIDTH) {
                    hostingView.style.width = CANVAS_WIDTH + "px";
                    hostingView.style.marginLeft = (containerWidth - CANVAS_WIDTH) / 2 + "px";
                }
                else {
                    hostingView.style.width = CANVAS_WIDTH + "px";
                    hostingView.style.marginLeft = "0px";
                }
            }
        }

        resizeCanvas();

        //-------------------------------------------------------
        //Loading modal dialogs
        //-------------------------------------------------------

        //-------------------------------------------------------
        // New rank modal form
        //-------------------------------------------------------
        $ionicModal.fromTemplateUrl('templates/newRank.html', function (newRankModal) {
            $scope.newRankModal = newRankModal;
        }, {
            scope: $scope,
            animation: 'slide-in-up'
        });

        $scope.openNewRankModal = function () {
            $scope.newRankModal.show();
        };

        $scope.closeNewRankModal = function () {
            $scope.newRankModal.hide();
        };

        $rootScope.$on("whoSmarter-rankChanged", function (error, data) {

            SoundService.play("audio/finish_great_1");
            $scope.xpProgress = data.xpProgress;
            $scope.callbackAfterModal = data.callback;

            $scope.openNewRankModal();

        });

        $scope.$on('modal.hidden', function () {
            if ($scope.callbackAfterModal) {
                $scope.callbackAfterModal();
            }
        });

        $rootScope.$on("whoSmarter-rankChanged", function (error, data) {

            SoundService.play("audio/finish_great_1");
            $scope.xpProgress = data.xpProgress;
            $scope.callbackAfterModal = data.callback;

            $scope.openNewRankModal();

        });

        $scope.canvas = document.createElement("canvas");
        $scope.canvas.width = $rootScope.settings.xpControl.canvas.width;
        $scope.canvas.height = $rootScope.settings.xpControl.canvas.height;

        $scope.context = $scope.canvas.getContext('2d');

        angular.element(document.querySelector("#canvasWrapper")).append($scope.canvas);

        if ($rootScope.session) {
            XpService.initXp($scope.canvas, $scope.context);
        }

        $scope.$watch(function () {
            return $ionicSideMenuDelegate.isOpen();
        }, function (value) {
            if (!value) {
                $scope.canvas.className = "menu-xp-" + $rootScope.settings.languages[$rootScope.user.settings.language].direction;
            }
            else {
                $scope.canvas.className = "menu-xp-menu-open";
            }
        });

    })

    .controller("HomeCtrl", function ($scope, $rootScope, $state, UserService, PopupService, $ionicHistory, $ionicPopup, $translate, $window) {

        $scope.$on('$ionicView.beforeEnter', function () {

            if ($rootScope.session) {
                $rootScope.gotoView("app.contests.mine");
            }
            else if (!$rootScope.user) {
                UserService.initUser(function () {
                    UserService.resolveEvents();
                });
            }
            else {
                UserService.resolveEvents();
            }
        });

        $scope.changeLanguage = function (language) {
            $rootScope.user.settings.language = language.value;
            StoreService.setLanguage(language.value);
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
                    return "100%"
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

        $scope.$on("whoSmarter-windowResize", function () {
            angular.element(document.querySelector("#demoContestImage")).width = $scope.getDemoContestWidth();
        });

        $scope.$on("whoSmarter-orientationChanged", function () {
            angular.element(document.querySelector("#demoContestImage")).width = $scope.getDemoContestWidth();
        });

        $scope.facebookConnect = function () {
            UserService.facebookClientConnect(function (session) {
                $rootScope.gotoView("app.contests.mine");
            })
        };

    })

    .controller("ContestsCtrl", function ($scope, $state, $rootScope, $ionicHistory, $translate, ContestsService, PopupService, $timeout, ChartService, $ionicTabsDelegate, UserService) {

        var tabs = ["app.contests.mine", "app.contests.running", "app.contests.recentlyFinished"];

        UserService.resolveEvents();

        var shouldTriggerScrollInfiniteRealFunction = false; //handling ionic bug regarding scroll infinite called twice

        $scope.$on('$ionicView.beforeEnter', function () {
            if (!$rootScope.session) {
                $rootScope.gotoView("home");
                return;
            }

            $scope.doRefresh();
        });

        $scope.$on('whoSmarter-tabChanged', function () {
            $rootScope.gotoView(tabs[$ionicTabsDelegate.selectedIndex()]);
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

        $scope.showPlay = function () {
            return ($state.current.appData && $state.current.appData.showPlay);
        };

        $scope.showContestParticipants = function () {
            return ($state.current.appData && $state.current.appData.showParticipants);
        };

        $scope.haveMoreContests = function () {
            return ($scope.totalContests == -1 || //never retrieved from the server
            ($scope.totalContests > 0 && $scope.contestCharts.length < $scope.totalContests)); //retrieved, server has data, and I have less than the server
        };

        $scope.showParticipants = function () {
            //TODO: show top 10 contest participants!
            PopupService.alert("TODO: show top 10 contest participants!");
        }

        $scope.infiniteLoadMoreContests = function () {
            $timeout(function () {
                if (!shouldTriggerScrollInfiniteRealFunction) {  //let the first time triggers this code that does nothing but completing the buggy first infinite scroll triggering
                    shouldTriggerScrollInfiniteRealFunction = true; // set the boolean to true so that the real load function is called next time infinite scrolling triggers
                    $scope.$broadcast('scroll.infiniteScrollComplete');
                }
                else {  // here it will be the real need for scrolling
                    $scope.loadMoreContests();
                }
            }, 100);
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
                config = {"blockUserInterface": false}
            }

            ContestsService.getContests(postData, function (contestsResult) {
                $scope.totalContests = contestsResult.count;

                if ($scope.totalContests === 0 && $ionicTabsDelegate.selectedIndex() === 0) {
                    //If no "my contests" - switch to running contests
                    $rootScope.gotoView(tabs[1]);
                    return;
                }

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

                if (fullRefresh) {
                    $scope.$broadcast('scroll.refreshComplete');
                }
            }, null, config);
        }

        $scope.playContest = function (contest) {
            if (contest.myTeam == 0 || contest.myTeam == 1) {
                $rootScope.gotoView("app.quiz", false, {contestId: contest._id});
            }
            else {
                PopupService.alert({"type": "SERVER_ERROR_NOT_JOINED_TO_CONTEST"});
            }
        };

        ChartService.setEvents($scope);
    })

    .controller("QuizCtrl", function ($scope, $rootScope, $state, $stateParams, UserService, QuizService, PopupService, $ionicHistory, $translate, $timeout, SoundService, XpService) {

        var quizCanvas;
        var quizContext;
        if (!quizCanvas) {
            quizCanvas = document.getElementById("quizCanvas");
            quizContext = quizCanvas.getContext("2d");
        }

        var imgCorrect = document.createElement('img');
        imgCorrect.src = '../images/correct.png';
        var imgError = document.createElement('img');
        imgError.src = '../images/error.png';

        $scope.$on('$ionicView.beforeEnter', function (event, viewData) {

            viewData.enableBack = true;
            startQuiz();

        });

        $scope.$on("whoSmarter-windowResize", function () {
            drawQuizProgress();
        });

        function drawQuizProgress() {

            var topOffset = 10;
            var radius = 20;
            var inactiveColor = "#5f5f5f";
            var activeColor = "#b8128f";

            quizCanvas.width = quizCanvas.clientWidth;
            quizContext.beginPath();
            quizContext.moveTo(0, radius + topOffset);
            quizContext.lineTo(quizCanvas.width, radius + topOffset);
            quizContext.lineWidth = 7;

            // set line color
            quizContext.strokeStyle = inactiveColor
            quizContext.stroke();
            quizContext.fill();
            quizContext.closePath();

            var currentX;
            if ($rootScope.settings.languages[$rootScope.user.settings.language].direction === "ltr") {
                currentX = radius;
            }
            else {
                currentX = quizCanvas.width - radius;
            }

            var circleOffsets = (quizCanvas.width - $scope.quiz.totalQuestions * radius * 2) / ($scope.quiz.totalQuestions - 1);
            for (var i = 0; i < $scope.quiz.totalQuestions; i++) {

                quizContext.beginPath();
                quizContext.fillStyle = inactiveColor;
                quizContext.arc(currentX, radius + topOffset, radius, 0, Math.PI * 2, false);
                quizContext.fill();
                quizContext.closePath();

                quizContext.beginPath();
                if (i === $scope.quiz.currentQuestionIndex - 1 && $scope.questionHistory.length < $scope.quiz.totalQuestions) {
                    quizContext.fillStyle = activeColor;
                    quizContext.arc(currentX, radius + topOffset, radius, 0, Math.PI * 2, false);
                    quizContext.fill();
                }
                else {
                    if ($scope.questionHistory.length > 0 && i < $scope.questionHistory.length) {
                        var x = currentX - radius;

                        if ($scope.questionHistory[i]) {
                            quizContext.drawImage(imgCorrect, x, topOffset, radius * 2, radius * 2);
                        }
                        else {
                            quizContext.drawImage(imgError, x, topOffset, radius * 2, radius * 2);
                        }
                    }
                }
                quizContext.closePath();

                if ($rootScope.settings.languages[$rootScope.user.settings.language].direction === "ltr") {
                    if (i < $scope.quiz.totalQuestions - 1) {
                        currentX += circleOffsets + radius * 2;
                    }
                    else {
                        currentX = quizCanvas.width - radius;
                    }
                }
                else {
                    if (i < $scope.quiz.totalQuestions - 1) {
                        currentX = currentX - circleOffsets - (radius * 2);
                    }
                    else {
                        currentX = radius;
                    }
                }
            }

            quizContext.closePath();

        };

        function startQuiz() {

            if (!$stateParams.contestId) {
                $rootScope.gotoView("app.contests.mine");
                return;
            }

            var postData = {"contestId": $stateParams.contestId};
            if ($stateParams.teamId == 0 || $stateParams.teamId == 1) {
                postData.teamId = $stateParams.teamId;
            }

            QuizService.start(postData,
                function (data) {
                    $scope.quiz = data.quiz;
                    $scope.questionHistory = [];
                    drawQuizProgress();

                    //Might get xp if starting quiz by pressing a new team (joining contest)
                    if ($scope.quiz.xpProgress && $scope.quiz.xpProgress.addition > 0) {
                        XpService.addXp($scope.quiz.xpProgress.addition);
                    }

                    $scope.quiz.currentQuestion.answered = false;
                });
        }

        $scope.nextQuestion = function () {
            QuizService.nextQuestion(function (data) {
                $scope.quiz = data;
                $scope.quiz.currentQuestion.answered = false;
                $scope.quiz.currentQuestion.animation = true; //Animation end will trigger quiz proceed
                drawQuizProgress();
            });
        }

        $scope.questionAnimationEnd = function () {
            $scope.quiz.currentQuestion.animation = false; //Animation end will trigger quiz proceed
        }

        $scope.buttonAnimationEnded = function (button, event) {

            if ($scope.quiz.xpProgress && $scope.quiz.xpProgress.addition > 0) {
                XpService.addXp($scope.quiz.xpProgress, $scope.quizProceed);
            }

            if ((!$scope.quiz.xpProgress || !($scope.quiz.xpProgress.rankChanged)) && $scope.correctButtonId == button.id) {
                $scope.quizProceed();
            }
        };

        $scope.quizProceed = function () {
            if ($scope.quiz.finished) {
                drawQuizProgress();
                $rootScope.session.score += $scope.quiz.results.score;
                $rootScope.gotoView("app.quizResult", true, {results: $scope.quiz.results}, false);
            }
            else {
                $scope.nextQuestion();
            }
        }

        $scope.toggleSound = function () {
            UserService.toggleSound(
                function () {
                    $rootScope.session.settings.sound = !$rootScope.session.settings.sound;
                });
        };

        $scope.submitAnswer = function (answerId) {
            $scope.quiz.currentQuestion.answered = true;

            var config = {
                "onServerErrors": {
                    "SERVER_ERROR_SESSION_EXPIRED_DURING_QUIZ": {"next": startQuiz},
                    "SERVER_ERROR_GENERAL": {
                        "next": function () {
                            $ionicHistory.goBack();
                        }
                    }
                }
            };

            QuizService.answer({"id": answerId},
                function (data) {
                    var correctAnswerId;

                    $scope.questionHistory.push(data.question.correct);

                    if (data.results) {
                        //Will get here when quiz is finished
                        $scope.quiz.results = data.results;
                    }

                    //Rank might change during quiz - and feature might open
                    if (data.features) {
                        $rootScope.session.features = data.features;
                    }

                    if (data.xpProgress) {
                        $scope.quiz.xpProgress = data.xpProgress;
                    }
                    else {
                        $scope.quiz.xpProgress = null;
                    }

                    if (data.question.correct) {
                        correctAnswerId = answerId;
                        $scope.quiz.currentQuestion.answers[answerId - 1].answeredCorrectly = true;
                        SoundService.play("audio/click_ok");
                    }
                    else {
                        SoundService.play("audio/click_wrong");
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

    .controller("QuizResultCtrl", function ($scope, $rootScope, $stateParams, $state, $translate, $ionicHistory, ContestsService, SoundService, ChartService) {

        if (!$scope.contestCharts) {
            $scope.contestCharts = [{}];
        }

        $scope.$on('$ionicView.beforeEnter', function (event, viewData) {

            if (!$stateParams.results) {
                $rootScope.gotoView("app.contests.mine");
                return;
            }

            viewData.enableBack = false;
            $rootScope.hideMenuButton = true;

            $scope.results = $stateParams.results;

            //Work with an array becase ChartService.setEvents works with an array scope property called contestCharts
            $scope.contestCharts = [ContestsService.prepareContestChart($scope.results.contest, 0)];

            //Play sound only if enabled and not came by pressing back
            if (!$rootScope.lastPlayed || $rootScope.lastPlayed < $stateParams.results.contest.lastPlayed) {
                SoundService.play($scope.results.sound);
            }

            $rootScope.lastPlayed = $stateParams.results.contest.lastPlayed;
        });

        $scope.$on('$ionicView.beforeLeave', function () {

            $rootScope.hideMenuButton = false;
        });

        $scope.playAgain = function () {

            $rootScope.gotoView("app.quiz", false, {
                contestId: $scope.results.contest._id,
                teamId: $scope.results.contest.myTeam
            });

        };

        ChartService.setEvents($scope);

    })

    .controller("LogoutCtrl", function ($scope, $rootScope, $state, UserService, PopupService, $ionicHistory, $translate) {

        $scope.$on('$ionicView.beforeEnter', function () {
            var language = $rootScope.user.settings.language;
            UserService.logout(function () {
                if (language !== $rootScope.user.settings.language) {
                    $translate.use($rootScope.user.settings.language);
                    StoreService.setLanguage($rootScope.user.settings.language);
                }
                $rootScope.gotoView("home");
            });
        });
    })

    .controller("SettingsCtrl", function ($scope, $rootScope, $ionicPopover, $ionicSideMenuDelegate, UserService, PopupService, $translate, $ionicConfig, StoreService) {

        $ionicConfig.backButton.previousTitleText("");
        $ionicConfig.backButton.text("");

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
            if ($scope.languagePopover) {
                $scope.languagePopover.remove();
            }
        });

        $scope.$on('$ionicView.beforeLeave', function () {
            if (JSON.stringify($scope.localViewData) != JSON.stringify($rootScope.session.settings)) {
                //Dirty settings - save to server
                var postData = {"settings": $scope.localViewData};
                UserService.saveSettingsToServer(postData,
                    function (data) {
                        prevLanguage = $rootScope.user.settings.language;
                        $rootScope.user.settings = $scope.localViewData;
                        $rootScope.session.settings = $scope.localViewData;
                        if ($scope.localViewData.language != prevLanguage) {
                            $translate.use($scope.localViewData.language);
                            StoreService.setLanguage($scope.localViewData.language);

                            //Check to fire directionChanged event
                            if ($rootScope.settings.languages[$scope.localViewData.language].direction != $rootScope.settings.languages[prevLanguage].direction) {
                                $rootScope.$broadcast('whoSmarter-directionChanged');
                            }
                        }
                    });
            }
        });
    })

    .controller("OtherwiseCtrl", function ($scope, $rootScope, $state) {
        $scope.$on('$ionicView.beforeEnter', function () {
            $rootScope.gotoRootView();
        });
    })

    .controller("ContestCtrl", function ($scope, $rootScope, $state, $ionicHistory, $translate, $stateParams, ContestsService, PopupService, $ionicPopup, $ionicPopover, PaymentService, $ionicConfig) {

        $ionicConfig.backButton.previousTitleText("");
        $ionicConfig.backButton.text("");

        var startDate = new Date();
        var endDate = new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000);

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

        if (!$rootScope.session.isAdmin) {
            //Only Admins are allowed to set past dates
            $scope.contestStartDatePicker.from = startDate;
            $scope.contestEndDatePicker.from = startDate;
        }
        else {
            var pastDate = new Date(1970, 0, 1);
            $scope.contestStartDatePicker.from = pastDate;
            $scope.contestEndDatePicker.from = pastDate;
        }

        $scope.contestEndOptions = {
            "m30": {"value": "m30", "number": 30, "units": "ENDS_IN_MINUTES", "msecMultiplier": 60 * 1000},
            "h4": {"value": "h4", "number": 4, "units": "ENDS_IN_HOURS", "msecMultiplier": 60 * 60 * 1000},
            "h24": {"value": "h24", "number": 24, "units": "ENDS_IN_HOURS", "msecMultiplier": 60 * 60 * 1000},
            "d3": {"value": "d3", "number": 3, "units": "ENDS_IN_DAYS", "msecMultiplier": 24 * 60 * 60 * 1000}
        }

        //-------------------------------------------------------
        // Choose Contest end option Popover
        // -------------------------------------------------------
        $ionicPopover.fromTemplateUrl('templates/chooseEndsIn.html', {
            scope: $scope
        }).then(function (contestEndsInPopover) {
            $scope.contestEndsInPopover = contestEndsInPopover;
        });

        $scope.openContestEndsInPopover = function ($event) {
            $scope.contestEndsInPopover.show($event);
        };

        $scope.closeContestEndsInPopover = function (contestEndsInOption) {
            $scope.localViewData.endOption = contestEndsInOption.value;
            $scope.localViewData.endDate = new Date((new Date()).getTime() + $scope.contestEndOptions[contestEndsInOption.value].number * $scope.contestEndOptions[contestEndsInOption.value].msecMultiplier);
            $scope.contestEndsInPopover.hide();
        };

        //Cleanup the popover when we're done with it!
        $scope.$on('$destroy', function () {
            if ($scope.contestEndsInPopover) {
                $scope.contestEndsInPopover.remove();
            }
        });

        $scope.$on('$ionicView.beforeEnter', function (event, viewData) {
            if ($stateParams.mode) {
                $scope.mode = $stateParams.mode;
                if ($stateParams.mode == "edit") {
                    if ($stateParams.contest) {
                        $scope.localViewData = JSON.parse(JSON.stringify($stateParams.contest));
                        //Server stores in epoch - client uses real DATE objects
                        $scope.localViewData.startDate = new Date($scope.localViewData.startDate);
                        $scope.localViewData.endDate = new Date($scope.localViewData.endDate);

                        if ($scope.localViewData.participants > 0) {
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
                    //Create new local instance of a contest
                    $scope.localViewData = {
                        "startDate": startDate,
                        "endDate": endDate,
                        "endOption": "h24",
                        "participants": 0,
                        "manualParticipants": 0,
                        "manualRating": 0,
                        "teams": [{"name": null, "score": 0}, {"name": null, "score": 0}]
                    };

                    $scope.showStartDate = true;
                }
            }
            else {
                $rootScope.gotoView("app.contests.mine");
                return;
            }

            $rootScope.session.features.newContest.purchaseData.retrieved = false;

            //-------------------------------------------------------------------------------------------------------------
            //Android Billing
            //-------------------------------------------------------------------------------------------------------------
            if ($rootScope.user.clientInfo.platform === "android" && $rootScope.session.features.newContest.locked) {
                if (!$rootScope.session.features.newContest.purchaseData.retrieved) {

                    //-------------------------------------------------------------------------------------------------------------
                    //pricing - replace cost/currency with the google store pricing (local currency, etc.)
                    //-------------------------------------------------------------------------------------------------------------
                    inappbilling.getProductDetails(function (products) {
                            //In android - the price already contains the symbol
                            $rootScope.session.features.newContest.purchaseData.formattedCost = products[0].price;
                            $rootScope.session.features.newContest.purchaseData.cost = products[0].price_amount_micros / 1000000;
                            $rootScope.session.features.newContest.purchaseData.currency = products[0].price_currency_code;

                            $rootScope.session.features.newContest.purchaseData.retrieved = true;

                            //-------------------------------------------------------------------------------------------------------------
                            //Retrieve unconsumed items - and checking if user has an unconsumed "new contest unlock key"
                            //-------------------------------------------------------------------------------------------------------------
                            inappbilling.getPurchases(function (unconsumedItems) {
                                    if (unconsumedItems && unconsumedItems.length > 0) {
                                        for (var i = 0; i < unconsumedItems.length; i++) {
                                            if (unconsumedItems[i].productId === $rootScope.session.features.newContest.purchaseData.productId) {
                                                processAndroidPurchase(unconsumedItems[i]);
                                                break;
                                            }
                                        }
                                    }
                                },
                                function (error) {
                                    console.log("Error retrieving unconsumed items: " + error);
                                });

                        },
                        function (msg) {
                            alert("error getting product details: " + msg);
                        }, $rootScope.session.features.newContest.purchaseData.productId);


                }
            }
            else {
                $rootScope.session.features.newContest.purchaseData.retrieved = true;
            }

            if ($ionicHistory.backView() == null) {
                $scope.enableBack = false;
            }
            else {
                $scope.enableBack = true;
            }

            viewData.enableBack = true;

            $scope.localViewData.totalParticipants = $scope.localViewData.participants + $scope.localViewData.manualParticipants;
            $scope.showAdminInfo = false;

            //Bug - currently not working - issue opened
            $scope.contestStartDatePicker.inputDate = startDate;
            $scope.contestEndDatePicker.inputDate = endDate;
            $scope.datePickerLoaded = true;

        });

        $scope.toggleAdminInfo = function () {
            if ($scope.localViewData.teams[0].name && $scope.localViewData.teams[1].name) {
                $scope.showAdminInfo = !$scope.showAdminInfo;
            }
        };

        $scope.getArrowDirection = function (stateClosed) {
            if (stateClosed) {
                if ($rootScope.settings.languages[$rootScope.session.settings.language].direction == "ltr") {
                    return "►";
                }
                else {
                    return "◄";
                }
            }
            else {
                return "▼";
            }
        }

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
                        $rootScope.$broadcast("whoSmarter-contestUpdated", contest);
                        $scope.goBack();
                    }, function (status, error) {
                        $scope.localViewData.startDate = startDate;
                        $scope.localViewData.endDate = endDate;
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

            var okButton = {
                text: $translate.instant("OK"),
                type: 'button-positive',
                onTap: function (e) {
                    // Returning a value will cause the promise to resolve with the given value.
                    return "OK";
                }
            };
            var cancelButton = {
                text: $translate.instant("CANCEL"),
                type: 'button-default',
                onTap: function (e) {
                    return null;
                }
            };

            var buttons = [];
            buttons.push(okButton);
            buttons.push(cancelButton);

            PopupService.confirm("CONFIRM_REMOVE_TITLE", "CONFIRM_REMOVE_TEMPLATE", {name: contestName}, function () {
                var postData = {"contestId": $scope.localViewData._id};
                ContestsService.removeContest(postData,
                    function (data) {
                        $rootScope.$broadcast("whoSmarter-contestRemoved");
                        $scope.goBack();
                    });

            });
        };

        $scope.hideRemoveContest = function () {
            if ($stateParams.mode == 'add' || !$rootScope.session.isAdmin) {
                return true;
            }
            else {
                return false;
            }
        }

        $scope.buyNewContestUnlockKey = function (isMobile) {
            $scope.buyInProgress = true;
            PaymentService.buy($rootScope.session.features.newContest, isMobile, function (result) {
                switch (result.method) {
                    case "paypal":
                        location.replace(result.data.url);
                        break;

                    case "facebook":
                        if (result.data.status === "completed") {
                            var transactionData = {"method": "facebook"};
                            transactionData.purchaseData = result.data;
                            PaymentService.processPayment(transactionData, function (serverPurchaseData) {
                                //Update local assets
                                $scope.buyInProgress = false;
                                PaymentService.showPurchaseSuccess(serverPurchaseData);
                            }, function (status, data) {
                                $scope.buyInProgress = false;
                            });
                        }
                        else if (result.data.status === "initiated") {
                            //Payment might come later from server
                            PopupService.alert({"type": "SERVER_ERROR_PURCHASE_IN_PROGRESS"});
                        }
                        break;

                    case "android":
                        processAndroidPurchase(result.data, function (data) {
                                $scope.buyInProgress = false;
                            },
                            function (status, error) {
                                $scope.buyInProgress = false;
                            })
                        break;
                }
            }, function (error) {
                $scope.$apply(function () {
                    $scope.buyInProgress = false;
                })
            });
        };

        function processAndroidPurchase(purchaseData, callbackOnSuccess) {
            var transactionData = {
                "method": "android",
                "purchaseData": purchaseData,
                "extraPurchaseData": {
                    "actualCost": $rootScope.session.features.newContest.purchaseData.cost,
                    "actualCurrency": $rootScope.session.features.newContest.purchaseData.currency,
                    "featurePurchased": $rootScope.session.features.newContest.name
                }
            };
            PaymentService.processPayment(transactionData, function (serverPurchaseData) {
                inappbilling.consumePurchase(function (purchaseData) {
                        if (callbackOnSuccess) {
                            callbackOnSuccess(purchaseData);
                        }
                        PaymentService.showPurchaseSuccess(serverPurchaseData);
                    }, function (error) {
                        alert("Error consuming product: " + error)
                    },
                    purchaseData.productId);
            });
        }
    })

    .controller("PayPalPaymentSuccessCtrl", function ($scope, $rootScope, $state, $stateParams, PaymentService, PopupService) {

        $scope.$on('$ionicView.beforeEnter', function () {

            var transactionData = {"method": "paypal"};
            transactionData.purchaseData = {};
            transactionData.purchaseData.purchaseToken = $stateParams.token;
            transactionData.purchaseData.payerId = $stateParams.PayerID;

            PaymentService.processPayment(transactionData, function (serverPurchaseData) {
                    PaymentService.showPurcaseSuccess(serverPurchaseData);
                },
                function (status, error, headers) {
                    PopupService.alert(error).then(function () {
                        $rootScope.gotoRootView();
                    });
                });
        });
    })

    .controller("PaymentCtrl", function ($scope, $rootScope, $state, $stateParams, PaymentService, $translate) {

        $scope.$on('$ionicView.beforeEnter', function () {

            $scope.nextView = $stateParams.nextView;
            $scope.unlockText = $translate.instant($rootScope.session.features[$stateParams.featurePurchased].unlockText);

        });

        $scope.proceed = function () {
            $rootScope.gotoView($scope.nextView.name, $scope.nextView.isRoot, $scope.nextView.params);
        }
    })

    .controller("FacebookCanvasCtrl", function ($scope, $rootScope, $state, $stateParams, UserService) {
        $rootScope.gotoRootView();
    })

    .controller("ServerPopupCtrl", function ($scope, $rootScope, $state, $stateParams, $ionicHistory, $timeout, $ionicPlatform) {

        $scope.$on('$ionicView.beforeEnter', function () {
            if (!$stateParams.serverPopup) {
                $rootScope.gotoRootView();
            }
        });

        $scope.serverPopup = $stateParams.serverPopup;

        $scope.buttonAction = function (button) {
            switch (button.action) {
                case "dismiss" :
                    $ionicHistory.goBack();
                    break;

                case "link" :
                {
                    window.open(button.link, "_system", "location=yes");
                    $ionicHistory.goBack();
                    break;
                }

                case "linkExit" :
                {
                    window.open(button.link, "_system", "location=yes");
                    $timeout(function () {
                        ionic.Platform.exitApp();
                    }, 1000)
                    break;
                }

                case "screen" :
                {
                    $rootScope.gotoView(button.screen, button.isRootView, button.params, button.clearHistory);
                    break;
                }
            }

        }
    });
