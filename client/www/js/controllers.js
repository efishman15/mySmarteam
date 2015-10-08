angular.module('whoSmarter.controllers', ['whoSmarter.services', 'ngAnimate'])

    .controller("AppCtrl", function ($scope, $rootScope, XpService, $ionicSideMenuDelegate, PopupService, SoundService, $ionicModal, ScreenService) {

        $rootScope.$on('whoSmarter-directionChanged', function () {
            $scope.canvas.className = "menu-xp-" + $rootScope.settings.languages[$rootScope.user.settings.language].direction;
        });

        $scope.$on("whoSmarter-windowResize", function () {
            ScreenService.resizeCanvas();
        });

        $scope.$on("whoSmarter-orientationChanged", function () {
            ScreenService.resizeCanvas();
        });

        ScreenService.resizeCanvas();

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

    .controller("HomeCtrl", function ($scope, $rootScope, $state, UserService, PopupService, $ionicHistory, $ionicPopup, $translate, ScreenService) {

        ScreenService.resizeCanvas();

        $scope.$on("whoSmarter-windowResize", function () {
            ScreenService.resizeCanvas();
        });

        $scope.$on("whoSmarter-orientationChanged", function () {
            ScreenService.resizeCanvas();
        });

        $scope.$on('$ionicView.beforeEnter', function () {

            if ($rootScope.session) {
                $rootScope.gotoView("app.tabs.myContests");
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

        $scope.facebookConnect = function () {
            UserService.facebookClientConnect(function (session) {
                $rootScope.gotoView("app.tabs.myContests");
            })
        };
    })

    .controller("ContestsCtrl", function ($scope, $state, $stateParams, $rootScope, $ionicHistory, $translate, ContestsService, PopupService, $timeout, ChartService, $ionicTabsDelegate, UserService, $window, $location) {

        var tabs = ["app.tabs.myContests", "app.tabs.runningContests", "app.tabs.recentlyFinishedContests"];

        $scope.roundTabState = [true, false, false];

        UserService.resolveEvents();

        var shouldTriggerScrollInfiniteRealFunction = false; //handling ionic bug regarding scroll infinite called twice

        $scope.$on('$ionicView.beforeEnter', function (event, viewData) {
            if (!$rootScope.session) {
                $rootScope.gotoView("home");
                return;
            }

            $scope.userClick = $stateParams.userClick;

            $scope.tab = $state.current.appData.serverTab;
            $scope.title = $state.current.appData.title;

            viewData.enableBack = false;

            $scope.roundTabState[0] = true;

            $scope.doRefresh();
        });

        $scope.roundTabSwitch = function (viewName) {
            $scope.roundTabState[0] = false;
            $rootScope.gotoView(viewName, false, {}, false, true);
        };

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

            var config;
            if ($scope.totalContests != -1) {
                config = {"blockUserInterface": false}
            }

            ContestsService.getContests(clientContestCount, $state.current.appData.serverTab, function (contestsResult) {
                $scope.totalContests = contestsResult.count;

                if (!$stateParams.userClick && $scope.totalContests === 0 && $ionicTabsDelegate.selectedIndex() === 0) {
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

        $scope.$on('$viewContentLoaded', function(event) {
            FlurryAgent.logEvent("page-" + $state.current.name);
        });
    })

    .controller("QuizCtrl", function ($scope, $rootScope, $state, $stateParams, UserService, QuizService, PopupService, $ionicHistory, $translate, $timeout, SoundService, XpService, $ionicModal, $ionicConfig, ContestsService) {

        $scope.mode = "quiz";

        var quizCanvas;
        var quizContext;
        if (!quizCanvas) {
            quizCanvas = angular.element(document.querySelector("#quizCanvas"));
            quizCanvas = document.getElementById("quizCanvas");
            quizContext = quizCanvas.getContext("2d");
            quizContext.font = $rootScope.settings.quiz.canvas.font;
        }

        var quizModeTitle = $translate.instant("QUIZ");
        var resultsModeTitle = $translate.instant("WHO_IS_SMARTER") + " - " + $translate.instant("QUIZ_RESULTS");

        //-------------------------------------------------------
        // Question stats Popover
        //-------------------------------------------------------
        $ionicModal.fromTemplateUrl('templates/questionInfo.html', {
            scope: $scope,
            animation: 'slide-in-up'
        }).then(function (questionInfoModal) {
            $scope.questionInfoModal = questionInfoModal;
        });

        $scope.openQuestionInfoModal = function () {
            $rootScope.preventBack = true;
            $scope.questionInfoModal.show();
        };

        $scope.closeQuestionInfoModal = function () {
            $rootScope.preventBack = false;
            $scope.questionInfoModal.hide();
        };

        $scope.$on('modal.hidden', function () {
            $rootScope.preventBack = false;
            $scope.questionChart = null;
        });

        //Cleanup the modal when we're done with it!
        $scope.$on('$destroy', function () {
            if ($scope.questionInfoModal) {
                $scope.questionInfoModal.remove();
            }
        });

        $scope.canvasClick = function (event) {
            if ($scope.currentQuestionCircle &&
                event.offsetX <= $scope.currentQuestionCircle.right &&
                event.offsetX >= $scope.currentQuestionCircle.left &&
                event.offsetY >= $scope.currentQuestionCircle.top &&
                event.offsetY <= $scope.currentQuestionCircle.bottom) {

                if ($scope.quiz.currentQuestion.correctRatio || $scope.quiz.currentQuestion.correctRatio == 0) {
                    $scope.questionChart = JSON.parse(JSON.stringify($rootScope.settings.charts.questionStats));

                    $scope.questionChart.chart.caption = $translate.instant("QUESTION_STATS_CHART_CAPTION");

                    $scope.questionChart.chart.paletteColors = $rootScope.settings.quiz.canvas.correctRatioColor + "," + $rootScope.settings.quiz.canvas.incorrectRatioColor;

                    $scope.questionChart.data = [];
                    $scope.questionChart.data.push({
                        "label": $translate.instant("ANSWERED_CORRECT"),
                        "value": $scope.quiz.currentQuestion.correctRatio
                    });
                    $scope.questionChart.data.push({
                        "label": $translate.instant("ANSWERED_INCORRECT"),
                        "value": (1 - $scope.quiz.currentQuestion.correctRatio)
                    });
                }

                $scope.openQuestionInfoModal(event);
            }
        };

        //Hash map - each item's key is the img.src and the value is an object like this:
        // loaded: true/false
        // drawRequests: array of drawRequest objects that each contain:
        //img, x, y, width, height
        var drawImageQueue = {};

        function initDrawImageQueue(src) {

            var img = document.createElement("img");
            drawImageQueue[src] = {"img": img, "loaded": false, "drawRequests": []};

            img.onload = function () {
                processDrawImageRequests(src);
            }
            img.src = src;
        }

        function drawImageAsync(imgSrc, x, y, width, height) {

            //If image loaded - draw right away
            if (drawImageQueue[imgSrc].loaded) {
                quizContext.drawImage(drawImageQueue[imgSrc].img, x, y, width, height);
                return;
            }

            var drawRequest = {
                "x": x,
                "y": y,
                "width": width,
                "height": height
            }

            //Add request to queue
            drawImageQueue[imgSrc].drawRequests.push(drawRequest);
        }

        function processDrawImageRequests(imgSrc) {

            drawImageQueue[imgSrc].loaded = true;
            while (drawImageQueue[imgSrc].drawRequests.length > 0) {
                var drawRequest = drawImageQueue[imgSrc].drawRequests.pop();
                quizContext.drawImage(drawImageQueue[imgSrc].img, drawRequest.x, drawRequest.y, drawRequest.width, drawRequest.height);
            }
        }

        var imgCorrectSrc = "images/correct.png";
        var imgErrorSrc = "images/error.png";
        var imgQuestionInfoSrc = "images/info_question.png";

        initDrawImageQueue(imgCorrectSrc);
        initDrawImageQueue(imgErrorSrc);
        initDrawImageQueue(imgQuestionInfoSrc);

        $scope.$on('$ionicView.beforeEnter', function (event, viewData) {

            $ionicConfig.backButton.previousTitleText("");
            $ionicConfig.backButton.text("");

            viewData.enableBack = true;
            if ($scope.mode === "quiz") {
                startQuiz();
            }
        });

        $scope.playAgain = function () {
            startQuiz();
        };

        $scope.$on("whoSmarter-windowResize", function () {
            drawQuizProgress();
        });

        function drawQuizProgress() {

            quizCanvas.width = quizCanvas.clientWidth;
            quizContext.beginPath();
            quizContext.moveTo(0, $rootScope.settings.quiz.canvas.radius + $rootScope.settings.quiz.canvas.topOffset);
            quizContext.lineTo(quizCanvas.width, $rootScope.settings.quiz.canvas.radius + $rootScope.settings.quiz.canvas.topOffset);
            quizContext.lineWidth = $rootScope.settings.quiz.canvas.lineWidth;

            // set line color
            quizContext.strokeStyle = $rootScope.settings.quiz.canvas.inactiveColor
            quizContext.stroke();
            quizContext.fill();
            quizContext.closePath();

            var currentX;
            if ($rootScope.settings.languages[$rootScope.user.settings.language].direction === "ltr") {
                currentX = $rootScope.settings.quiz.canvas.radius;
            }
            else {
                currentX = quizCanvas.width - $rootScope.settings.quiz.canvas.radius;
            }

            $scope.currentQuestionCircle = null;
            var circleOffsets = (quizCanvas.width - $scope.quiz.totalQuestions * $rootScope.settings.quiz.canvas.radius * 2) / ($scope.quiz.totalQuestions - 1);
            for (var i = 0; i < $scope.quiz.totalQuestions; i++) {

                if (i === $scope.quiz.currentQuestionIndex) {

                    //Question has no statistics about success ratio
                    quizContext.beginPath();
                    quizContext.fillStyle = $rootScope.settings.quiz.canvas.activeColor;
                    quizContext.arc(currentX, $rootScope.settings.quiz.canvas.radius + $rootScope.settings.quiz.canvas.topOffset, $rootScope.settings.quiz.canvas.radius, 0, Math.PI * 2, false);
                    quizContext.fill();
                    quizContext.closePath();

                    $scope.currentQuestionCircle = {
                        "top": $rootScope.settings.quiz.canvas.topOffset,
                        "left": currentX - $rootScope.settings.quiz.canvas.radius,
                        "bottom": $rootScope.settings.quiz.canvas.topOffset + 2 * $rootScope.settings.quiz.canvas.radius,
                        "right": currentX + $rootScope.settings.quiz.canvas.radius
                    };

                    //Current question has statistics about success ratio
                    if ($scope.quiz.currentQuestion.correctRatio || $scope.quiz.currentQuestion.correctRatio == 0) {

                        //Draw the correct ratio
                        if ($scope.quiz.currentQuestion.correctRatio > 0) {
                            quizContext.beginPath();
                            quizContext.moveTo(currentX, $rootScope.settings.quiz.canvas.radius + $rootScope.settings.quiz.canvas.topOffset);
                            quizContext.fillStyle = $rootScope.settings.quiz.canvas.correctRatioColor;
                            quizContext.arc(currentX, $rootScope.settings.quiz.canvas.radius + $rootScope.settings.quiz.canvas.topOffset, $rootScope.settings.quiz.canvas.pieChartRadius, 0, -$scope.quiz.currentQuestion.correctRatio * Math.PI * 2, true);
                            quizContext.fill();
                            quizContext.closePath();
                        }

                        //Draw the incorrect ratio
                        if ($scope.quiz.currentQuestion.correctRatio < 1) {
                            quizContext.beginPath();
                            quizContext.moveTo(currentX, $rootScope.settings.quiz.canvas.radius + $rootScope.settings.quiz.canvas.topOffset);
                            quizContext.fillStyle = $rootScope.settings.quiz.canvas.incorrectRatioColor;
                            quizContext.arc(currentX, $rootScope.settings.quiz.canvas.radius + $rootScope.settings.quiz.canvas.topOffset, $rootScope.settings.quiz.canvas.pieChartRadius, -$scope.quiz.currentQuestion.correctRatio * Math.PI * 2, Math.PI * 2, true);
                            quizContext.fill();
                            quizContext.closePath();
                        }
                    }
                    else {
                        //Question has no stats - draw an info icon inside to make user press
                        drawImageAsync(imgQuestionInfoSrc, currentX - $rootScope.settings.quiz.canvas.pieChartRadius, $rootScope.settings.quiz.canvas.topOffset + $rootScope.settings.quiz.canvas.radius - $rootScope.settings.quiz.canvas.pieChartRadius, $rootScope.settings.quiz.canvas.pieChartRadius * 2, $rootScope.settings.quiz.canvas.pieChartRadius * 2);
                    }
                }
                else {
                    quizContext.beginPath();
                    quizContext.fillStyle = $rootScope.settings.quiz.canvas.inactiveColor;
                    quizContext.arc(currentX, $rootScope.settings.quiz.canvas.radius + $rootScope.settings.quiz.canvas.topOffset, $rootScope.settings.quiz.canvas.radius, 0, Math.PI * 2, false);
                    quizContext.fill();
                    quizContext.closePath();

                }

                //Draw correct/incorrect for answered
                if ($scope.questionHistory[i].answer != null) {
                    if ($scope.questionHistory[i].answer) {
                        drawImageAsync(imgCorrectSrc, currentX - $rootScope.settings.quiz.canvas.radius, $rootScope.settings.quiz.canvas.topOffset, $rootScope.settings.quiz.canvas.radius * 2, $rootScope.settings.quiz.canvas.radius * 2);
                    }
                    else {
                        drawImageAsync(imgErrorSrc, currentX - $rootScope.settings.quiz.canvas.radius, $rootScope.settings.quiz.canvas.topOffset, $rootScope.settings.quiz.canvas.radius * 2, $rootScope.settings.quiz.canvas.radius * 2);
                    }
                }

                if ($rootScope.settings.languages[$rootScope.user.settings.language].direction === "ltr") {
                    if (i < $scope.quiz.totalQuestions - 1) {
                        currentX += circleOffsets + $rootScope.settings.quiz.canvas.radius * 2;
                    }
                    else {
                        currentX = quizCanvas.width - $rootScope.settings.quiz.canvas.radius;
                    }
                }
                else {
                    if (i < $scope.quiz.totalQuestions - 1) {
                        currentX = currentX - circleOffsets - ($rootScope.settings.quiz.canvas.radius * 2);
                    }
                    else {
                        currentX = $rootScope.settings.quiz.canvas.radius;
                    }
                }
            }

            drawQuizScores();

        };

        function drawQuizScores() {

            quizContext.beginPath();
            quizContext.clearRect(0, 0, quizCanvas.width, $rootScope.settings.quiz.canvas.scores.top);
            quizContext.closePath();

            var currentX;
            if ($rootScope.settings.languages[$rootScope.user.settings.language].direction === "ltr") {
                currentX = $rootScope.settings.quiz.canvas.radius;
            }
            else {
                currentX = quizCanvas.width - $rootScope.settings.quiz.canvas.radius;
            }

            var circleOffsets = (quizCanvas.width - $scope.quiz.totalQuestions * $rootScope.settings.quiz.canvas.radius * 2) / ($scope.quiz.totalQuestions - 1);
            for (var i = 0; i < $scope.quiz.totalQuestions; i++) {

                //Draw question score
                var textWidth = quizContext.measureText($scope.questionHistory[i].score).width;
                var scoreColor = $rootScope.settings.quiz.canvas.inactiveColor;

                if ($scope.questionHistory[i].answer && !$scope.questionHistory[i].answerUsed) {
                    scoreColor = $rootScope.settings.quiz.canvas.correctRatioColor;
                }

                //Draw the score at the top of the circle
                quizContext.beginPath();
                quizContext.fillStyle = scoreColor;
                quizContext.fillText($scope.questionHistory[i].score, currentX + textWidth / 2, $rootScope.settings.quiz.canvas.scores.top);
                quizContext.closePath();

                if ($rootScope.settings.languages[$rootScope.user.settings.language].direction === "ltr") {
                    if (i < $scope.quiz.totalQuestions - 1) {
                        currentX += circleOffsets + $rootScope.settings.quiz.canvas.radius * 2;
                    }
                    else {
                        currentX = quizCanvas.width - $rootScope.settings.quiz.canvas.radius;
                    }
                }
                else {
                    if (i < $scope.quiz.totalQuestions - 1) {
                        currentX = currentX - circleOffsets - ($rootScope.settings.quiz.canvas.radius * 2);
                    }
                    else {
                        currentX = $rootScope.settings.quiz.canvas.radius;
                    }
                }
            }
        };

        function startQuiz() {

            if (!$stateParams.contestId) {
                $rootScope.gotoView("app.tabs.myContests");
                return;
            }

            $scope.mode = "quiz";

            QuizService.start($stateParams.contestId, $stateParams.teamId,
                function (data) {
                    $scope.quiz = data.quiz;
                    $scope.questionHistory = [];
                    for (var i = 0; i < data.quiz.totalQuestions; i++) {
                        $scope.questionHistory.push({"score": $rootScope.settings.quiz.questions.score[i]});
                    }
                    drawQuizProgress();

                    //Might get xp if starting quiz by pressing a new team (joining contest)
                    if ($scope.quiz.xpProgress && $scope.quiz.xpProgress.addition > 0) {
                        XpService.addXp($scope.quiz.xpProgress.addition);
                    }

                    $scope.quiz.currentQuestion.answered = false;
                });
        }

        $scope.getTitle = function () {

            if ($scope.mode === "quiz") {
                return quizModeTitle;
            }
            else {
                return resultsModeTitle;
            }
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

                $scope.contestCharts = [ContestsService.prepareContestChart($scope.quiz.results.contest, 0)];
                $scope.mode = "results";
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
                            $rootScope.goBack();
                        }
                    }
                }
            };

            QuizService.answer(answerId, $scope.questionHistory[$scope.quiz.currentQuestionIndex].hintUsed, $scope.questionHistory[$scope.quiz.currentQuestionIndex].answerUsed,
                function (data) {
                    var correctAnswerId;

                    $scope.questionHistory[$scope.quiz.currentQuestionIndex].answer = data.question.correct;

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
                }, null, config
            );
        }

        $scope.assistWithHint = function () {
            $scope.questionHistory[$scope.quiz.currentQuestionIndex].hintUsed = true;
            $scope.questionHistory[$scope.quiz.currentQuestionIndex].score = $rootScope.settings.quiz.questions.score[$scope.quiz.currentQuestionIndex] - $scope.quiz.currentQuestion.hintCost;
            drawQuizScores();
            $scope.closeQuestionInfoModal();
            window.open($rootScope.settings.languages[$rootScope.user.settings.language].wiki + $scope.quiz.currentQuestion.wikipediaHint, "_system", "location=yes");
        };

        $scope.assistWithAnswer = function () {
            $scope.questionHistory[$scope.quiz.currentQuestionIndex].answerUsed = true;
            $scope.questionHistory[$scope.quiz.currentQuestionIndex].score = $rootScope.settings.quiz.questions.score[$scope.quiz.currentQuestionIndex] - $scope.quiz.currentQuestion.answerCost;
            drawQuizScores();
            $scope.closeQuestionInfoModal();
            window.open($rootScope.settings.languages[$rootScope.user.settings.language].wiki + $scope.quiz.currentQuestion.wikipediaAnswer, "_system", "location=yes");
        };
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

                UserService.saveSettingsToServer($scope.localViewData,
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

    .controller("ContestCtrl", function ($scope, $rootScope, $state, $ionicHistory, $translate, $stateParams, ContestsService, PopupService, $ionicPopup, $ionicPopover, PaymentService, $ionicConfig, $ionicLoading) {

        $ionicConfig.backButton.previousTitleText("");
        $ionicConfig.backButton.text("");

        var startDate = new Date();
        var endDate = new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000);

        var datePickerToday = $translate.instant("DATE_PICKER_TODAY");
        var datePickerClose = $translate.instant("CLOSE");
        var datePickerSet = $translate.instant("SET");
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
fsdfsd
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
                        $rootScope.goBack();
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
                $rootScope.gotoView("app.tabs.myContests");
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
                            console.log("error getting product details: " + msg);
                        }, $rootScope.session.features.newContest.purchaseData.productId);


                }
            }
            else {
                $rootScope.session.features.newContest.purchaseData.retrieved = true;
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
                if (val >= $scope.localViewData.startDate || $rootScope.session.isAdmin) {
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

                //Add/update the new/updated contest to the server and in the local $rootScope
                ContestsService.setContest($scope.localViewData, $stateParams.mode,
                    function (contest) {
                        //Raise event - so the contest graph can be refreshed without going to the server again
                        $rootScope.$broadcast("whoSmarter-contestUpdated", contest);
                        $rootScope.goBack();
                    }, function (status, error) {
                        $scope.localViewData.startDate = startDate;
                        $scope.localViewData.endDate = endDate;
                    });
            }
            else {
                $rootScope.goBack();
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
                ContestsService.removeContest($scope.localViewData._id,
                    function (data) {
                        $rootScope.$broadcast("whoSmarter-contestRemoved");
                        $rootScope.goBack();
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
                            PaymentService.processPayment(result.method, result.data, null, function (serverPurchaseData) {
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
                        else {
                            //Probably user canceled
                            $scope.buyInProgress = false;
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
            var extraPurchaseData = {
                "actualCost": $rootScope.session.features.newContest.purchaseData.cost,
                "actualCurrency": $rootScope.session.features.newContest.purchaseData.currency,
                "featurePurchased": $rootScope.session.features.newContest.name
            };

            PaymentService.processPayment("android", purchaseData, extraPurchaseData, function (serverPurchaseData) {

                $ionicLoading.show({
                        animation: 'fade-in',
                        showBackdrop: true,
                        showDelay: 50
                    }
                );

                inappbilling.consumePurchase(function (purchaseData) {
                        $ionicLoading.hide();
                        if (callbackOnSuccess) {
                            callbackOnSuccess(purchaseData);
                        }
                        PaymentService.showPurchaseSuccess(serverPurchaseData);
                    }, function (error) {
                        $ionicLoading.hide();
                        console.log("Error consuming product: " + error)
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
                    $rootScope.goBack();
                    break;

                case "link" :
                {
                    window.open(button.link, "_system", "location=yes");
                    $rootScope.goBack();
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
    })

    .controller("ShareCtrl", function ($scope, $rootScope, $ionicConfig, $cordovaSocialSharing, $translate) {

        $ionicConfig.backButton.previousTitleText("");
        $ionicConfig.backButton.text("");
        $scope.$on('$ionicView.beforeEnter', function (event, viewData) {
            viewData.enableBack = true;
        });

        $scope.shareAnywhere = function () {
            $cordovaSocialSharing.share($translate.instant("SHARE_BODY_NO_URL"),
                $translate.instant("SHARE_SUBJECT"),
                $rootScope.settings.general.baseUrl + $rootScope.settings.general.logoUrl,
                $rootScope.settings.general.downloadUrl
            );
        };

        $scope.likeFacebookFanPage = function () {
            window.open($rootScope.settings.general.facebookFanPage, "_system", "location=yes");
        }
    })

    .controller("FriendsLeaderboardCtrl", function ($scope, $rootScope, LeaderboardService, FacebookService) {

        $scope.roundTabState = [false, true, false];

        $scope.$on('$ionicView.beforeEnter', function (event, viewData) {
            viewData.enableBack = false;

            $scope.roundTabState[1] = true;

            $scope.getFriends();

        });

        $scope.getFriends = function () {
            var config = {
                "onServerErrors": {
                    "SERVER_ERROR_MISSING_FRIENDS_PERMISSION": {"next": askFriendsPermissions, "confirm": true}
                }
            };

            LeaderboardService.getFriends(function (leaders) {
                $scope.leaders = leaders;
            }, null, config);
        }

        $scope.roundTabSwitch = function (viewName) {
            $scope.roundTabState[1] = false;
            $rootScope.gotoView(viewName, false, {}, false, true);
        };

        function askFriendsPermissions() {
            FacebookService.login(function (response) {
                    $scope.getFriends();
                },
                null,
                $rootScope.settings.facebook.friendsPermissions, true);
        }
    })

    .controller("WeeklyLeaderboardCtrl", function ($scope, $rootScope, LeaderboardService) {

        $scope.roundTabState = [false, false, true];

        $scope.$on('$ionicView.beforeEnter', function (event, viewData) {

            viewData.enableBack = false;

            $scope.roundTabState[2] = true;

            LeaderboardService.getWeeklyLeaders(function (leaders) {
                $scope.leaders = leaders;
            });

        });

        $scope.roundTabSwitch = function (viewName) {
            $scope.roundTabState[2] = false;
            $rootScope.gotoView(viewName, false, {}, false, true);
        };

    })

    .controller("ContestParticipantsCtrl", function ($scope, $rootScope, $ionicConfig, $translate, $stateParams, LeaderboardService) {

        $ionicConfig.backButton.previousTitleText("");
        $ionicConfig.backButton.text("");
        $scope.leaderboards = {
            "all": {"selected": true, "teamId": null},
            "team0": {"selected": false, "teamId": 0},
            "team1": {"selected": false, "teamId": 1},
        };

        $scope.selectLeaderboard = function (leaderboard) {

            $scope.leaderboards.all.selected = (leaderboard === "all");
            $scope.leaderboards.team0.selected = (leaderboard === "team0");
            $scope.leaderboards.team1.selected = (leaderboard === "team1");

            LeaderboardService.getContestLeaders($scope.contest._id, $scope.leaderboards[leaderboard].teamId, function (leaders) {
                $scope.leaders = leaders;
            });

        };

        $scope.$on('$ionicView.beforeEnter', function (event, viewData) {

            if (!$stateParams.contest) {
                $rootScope.gotoRootView();
                return;
            }

            viewData.enableBack = true;
            $scope.contest = $stateParams.contest;

            $scope.selectLeaderboard("all");

        });

    });
