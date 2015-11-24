angular.module("whoSmarter.app", ["whoSmarter.services", "whoSmarter.controllers", "ui.router", "ionic", "http-auth-interceptor", "ngMessages", "pascalprecht.translate", "ng-fusioncharts", "ezfb", "ionic-datepicker", "angular-storage", "ngCordova"])
    .run(function ($ionicPlatform, $rootScope, $location) {
        $ionicPlatform.ready(function () {

                //FlurryAgent.setDebugLogEnabled(true);
                FlurryAgent.startSession("NT66P8Q5BR5HHVN2C527");

                FlurryAgent.myLogError = function (errorType, message) {
                    console.log(message);
                    FlurryAgent.logError(errorType.substring(0, 255), message.substring(0, 255), 0);
                }

                // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
                // for form inputs)
                if (window.cordova && window.cordova.plugins.Keyboard) {
                    cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
                }

                if (window.cordova) {

                    //Must be set manually for keyboard issue when opened - to scroll elements of the focused field
                    ionic.Platform.isFullScreen = true;

                    cordova.getAppVersion(function (version) {
                        if ($rootScope.user && $rootScope.user.clientInfo) {
                            $rootScope.user.clientInfo.appVersion = version;
                        }
                        else {
                            $rootScope.appVersion = version;
                        }

                        FlurryAgent.setAppVersion("" + version);
                    });

                    //Hook into window.open
                    window.open = cordova.InAppBrowser.open;

                }

                window.myHandleBranch = function (err, data) {
                    try {
                        if (err) {
                            FlurryAgent.myLogError("BranchIoError", "Error received during branch init: " + err);
                            return;
                        }

                        if (data.data_parsed && data.data_parsed.contestId) {
                            //Will go to this contest
                            $rootScope.deepLinkContestId = data.data_parsed.contestId;
                        }
                    }
                    catch (e) {
                        FlurryAgent.myLogError("BranchIoError", "Error parsing data during branch init, data= " + data + ", parsedData=" + parsedData + ", error: " + e);
                    }
                };

                window.initBranch = function () {
                    branch.init("key_live_pocRNjTcwzk0YWxsqcRv3olivweLVuVE", function (err, data) {
                        if (window.myHandleBranch) {
                            window.myHandleBranch(err, data);
                        }
                    });
                }

                initBranch();

                if (window.StatusBar) {
                    // org.apache.cordova.statusbar required
                    StatusBar.styleDefault();
                }

                if (ionic.Platform.isAndroid() && typeof inappbilling !== "undefined") {
                    inappbilling.init(function (resultInit) {
                        },
                        function (errorInit) {
                            FlurryAgent.myLogError("InAppBilling", errorInit);
                        }
                        ,
                        {showLog: true}, []
                    );
                }

                // Fallback where requestAnimationFrame or its equivalents are not supported in the current browser
                window.myRequestAnimationFrame = (function () {
                    return window.requestAnimationFrame ||
                        window.webkitRequestAnimationFrame ||
                        window.mozRequestAnimationFrame ||
                        function (callback) {
                            window.setTimeout(callback, 1000 / 60);
                        };
                })();

                $rootScope.$on("$stateChangeSuccess", function (event, current) {
                    FlurryAgent.logEvent("page" + $location.url())
                });

            }
        );

        $ionicPlatform.on("resume", function (event) {
            if (window.cordova && window.initBranch) {
                window.initBranch();
            }

        });
    })

    .config(function ($httpProvider, $translateProvider) {
        $httpProvider.interceptors.push(function ($rootScope, $q) {
            return {
                request: function (config) {
                    $rootScope.$broadcast("whoSmarter-httpRequest", config)
                    return config;
                },
                response: function (response) {
                    $rootScope.$broadcast("whoSmarter-httpResponse", response)
                    return response;
                },
                responseError: function (rejection) {
                    $rootScope.$broadcast("whoSmarter-httpResponseError", rejection)
                    return $q.reject(rejection);
                }
            }
        })
    })

    .config(function ($ionicConfigProvider) {
        $ionicConfigProvider.backButton.text("");
        $ionicConfigProvider.backButton.previousTitleText("");
        $ionicConfigProvider.tabs.position("bottom");

        if (window.cordova) {
            loadJsFile("lib/branch/moblie.min.js");
        }
        else {
            loadJsFile("lib/branch/web.min.js");
        }
    })

    .config(function (ezfbProvider) {
        if (!window.cordova) {
            ezfbProvider.setInitParams({
                // This is my FB app id for plunker demo app
                appId: "344342552056",

                // Module default is `v2.0`.
                // If you want to use Facebook platform `v2.3`, you'll have to add the following parameter.
                // https://developers.facebook.com/docs/javascript/reference/FB.init
                version: "v2.5"
            });
        }
    })

    .config(function ($provide) {

        $provide.decorator("$exceptionHandler", function ($delegate, $injector) {
            return function (exception, cause) {
                FlurryAgent.myLogError("UnhandledException", exception.stack + ", cause: " + cause, 0);
            };
        });
    })

    .config(function ($translateProvider) {
        $translateProvider.useSanitizeValueStrategy("escaped");
        $translateProvider.useStaticFilesLoader({
            prefix: "languages/",
            suffix: ".json"
        });

        var lang = navigator.language || navigator.userLanguage;
        if (lang && lang.length >= 2) {
            var shortLangKey = lang.substring(0, 2);
            $translateProvider.determinePreferredLanguage(function () {
                return shortLangKey
            });
        }
    })

    .config(function ($ionicConfigProvider) {

        $ionicConfigProvider.backButton.previousTitleText(true);

    })

    .config(function ($stateProvider, $urlRouterProvider, $locationProvider) {

        $stateProvider
            .state("home", {
                "url": "/home",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "home");
                    }
                },
                "controller": "HomeCtrl",
                "templateUrl": "templates/home.html",
                "data": {
                    "exitApp" : true,
                    "backButtonHandler": function backHandler(event, PopupService, currentState, $rootScope) {
                        if (currentState && currentState.data && currentState.data.exitApp) {
                            PopupService.confirmExitApp();
                        }
                        else {
                            $rootScope.goBack();
                        }
                    }
                }
            })

            .state("serverPopup", {
                "url": "/serverPopup",
                "params": {"serverPopup": null},
                "controller": "ServerPopupCtrl",
                "templateUrl": "templates/serverPopup.html",
                "data": {
                    "currentPopup": null,
                    "backButtonHandler": function backHandler(event, PopupService, currentState, $rootScope) {
                        if (currentState.data.currentPopup && currentState.data.currentPopup.preventBack) {
                            event.preventDefault();
                        }
                        else {
                            $rootScope.goBack();
                        }
                    }
                }
            })

            .state("questionStats", {
                "url": "/questionStats",
                "params": {"serverPopup": null},
                "controller": "ServerPopupCtrl",
                "templateUrl": "templates/serverPopup.html"
            })

            .state("facebookCanvas", {
                "url": "/facebook?connected&signedRequest&language",
                "controller": "FacebookCanvasCtrl",
                "params": {"connected": null, "signedRequest": null, "language": null},
                "resolve": {
                    "auth": function resolveAuthentication(UserService, $stateParams) {
                        var data = {
                            "connected": $stateParams.connected,
                            "signedRequest": $stateParams.signedRequest,
                            "language": $stateParams.language
                        };
                        return UserService.resolveAuthentication(data, "fb");
                    }
                },
            })

            .state("otherwise", {
                "url": "/otherwise",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "otherwise");
                    }
                },
                "controller": "OtherwiseCtrl"
            })

            .state("app.share", {
                "url": "/share",
                "params": {"contest": null},
                "views": {
                    "menuContent": {
                        "templateUrl": "templates/share.html",
                        "controller": "ShareCtrl"
                    }
                }
            })

            .state("app.like", {
                "url": "/like",
                "params": {"contest": null},
                "views": {
                    "menuContent": {
                        "templateUrl": "templates/like.html",
                        "controller": "LikeCtrl"
                    }
                }
            })

            .state("app.contestParticipants", {
                "url": "/contestParticipants",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "contestParticipants");
                    }
                },
                "params": {"contest": null},
                "views": {
                    "menuContent": {
                        "templateUrl": "templates/contestParticipants.html",
                        "controller": "ContestParticipantsCtrl"
                    }
                }
            })

            .state("app.contest", {
                "url": "/contest",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "contest");
                    }
                },
                "params": {"id": null, "justCreated" : false},
                "views": {
                    "menuContent": {
                        "templateUrl": "templates/contest.html",
                        "controller": "ContestCtrl"
                    }
                },
                "data": {
                    "mobileShareModal": {"isOpenHandler": null, closeHandler: null},
                    "backButtonHandler": function backHandler(event, PopupService, currentState, $rootScope) {
                        if (currentState.data.mobileShareModal.isOpenHandler && currentState.data.mobileShareModal.isOpenHandler() && currentState.data.mobileShareModal.closeHandler) {
                            currentState.data.mobileShareModal.closeHandler();
                        }
                        else {
                            $rootScope.goBack();
                        }
                    }
                }
            })

            .state("app.facebookPost", {
                "url": "/facebookPost",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "facebookPost");
                    }
                },
                "params": {"quizResults": null},
                "views": {
                    "menuContent": {
                        "templateUrl": "templates/facebookPost.html",
                        "controller": "FacebookPostCtrl"
                    }
                }
            })

            .state("app.quiz", {
                "url": "/quiz",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "quiz");
                    }
                },
                "params": {"contestId": null},
                "views": {
                    "menuContent": {
                        "templateUrl": "templates/quiz.html",
                        "controller": "QuizCtrl"
                    }
                },
                "data": {
                    "questionInfo": {"isOpenHandler": null, closeHandler: null},
                    "backButtonHandler": function backHandler(event, PopupService, currentState, $rootScope) {
                        if (currentState.data.questionInfo.isOpenHandler && currentState.data.questionInfo.isOpenHandler() && currentState.data.questionInfo.closeHandler) {
                            currentState.data.questionInfo.closeHandler();
                        }
                        else {
                            $rootScope.goBack();
                        }
                    }
                }
            })

            .state("app.hostedGame", {
                "url": "/hostedGame",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "hostedGame");
                    }
                },
                "params": {"game": null, gameId: null},
                "views": {
                    "menuContent": {
                        "templateUrl": "templates/hostedGame.html",
                        "controller": "HostedGameCtrl"
                    }
                }
            })

            .state("app.setContest", {
                "url": "/setContest",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "setContest");
                    }
                },
                "views": {
                    "menuContent": {
                        "templateUrl": "templates/setContest.html",
                        "controller": "SetContestCtrl"
                    }
                },
                "params": {"mode": null, "contestId" : null, "contest": null, "contentCategoryId": null, content: null},
                "data": {
                    "questionModal": {"isOpenHandler": null, closeHandler: null},
                    "searchQuestionsModal": {"isOpenHandler": null, closeHandler: null},
                    "chooseGameModal": {"isOpenHandler": null, closeHandler: null},
                    "backButtonHandler": function backHandler(event, PopupService, currentState, $rootScope) {
                        if (currentState.data.questionModal.isOpenHandler && currentState.data.questionModal.isOpenHandler() && currentState.data.questionModal.closeHandler) {
                            currentState.data.questionModal.closeHandler();
                        }
                        else if (currentState.data.searchQuestionsModal.isOpenHandler && currentState.data.searchQuestionsModal.isOpenHandler() && currentState.data.searchQuestionsModal.closeHandler) {
                            currentState.data.searchQuestionsModal.closeHandler();
                        }
                        else if (currentState.data.chooseGameModal.isOpenHandler && currentState.data.chooseGameModal.isOpenHandler() && currentState.data.chooseGameModal.closeHandler) {
                            currentState.data.chooseGameModal.closeHandler();
                        }
                        else {
                            $rootScope.goBack();
                        }
                    }
                }
            })

            .state("payPalPaymentSuccess", {
                "url": "/payPalPaymentSuccess?token&PayerID",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "payPalPaymentSuccess");
                    }
                },
                "controller": "PayPalPaymentSuccessCtrl",
                "params": {"token": null, "PayerID": null}
            })

            .state("payment", {
                "url": "/payment?purchaseMethod&purchaseSuccess&token&PayerID",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "payment");
                    }
                },
                "templateUrl": "templates/payment.html",
                "controller": "PaymentCtrl",
                "params": {
                    "token": null,
                    "PayerID": null,
                    "productId": null,
                    "purchaseMethod": null,
                    "purchaseSuccess": null,
                    "nextView": null,
                    "featurePurchased": null
                }
            })

            .state("app.settings", {
                "url": "/settings",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "settings");
                    }
                },
                "views": {
                    "menuContent": {
                        "templateUrl": "templates/settings.html",
                        "controller": "SettingsCtrl"
                    }
                }
            })

            .state("app.systemTools", {
                "url": "/systemTools",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "systemTools");
                    }
                },
                "views": {
                    "menuContent": {
                        "templateUrl": "templates/systemTools.html",
                        "controller": "SystemToolsCtrl"
                    }
                }
            })

            .state("logout", {
                "url": "/logout",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "logout");
                    }
                },
                "controller": "LogoutCtrl"
            })

            .state("app", {
                url: "/app",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "menu");
                    }
                },
                abstract: true,
                templateUrl: "templates/menu.html",
                controller: "AppCtrl",
                "data": {
                    "contestType": {"isOpenHandler": null, closeHandler: null},
                    "backButtonHandler": function backHandler(event, PopupService, currentState, $rootScope) {
                        if (currentState.data.contestType.isOpenHandler && currentState.data.contestType.isOpenHandler() && currentState.data.contestType.closeHandler) {
                            currentState.data.contestType.closeHandler();
                        }
                        else {
                            if (currentState && currentState.data && currentState.data.exitApp) {
                                PopupService.confirmExitApp();
                            }
                            else
                            {
                                $rootScope.goBack();
                            }
                        }
                    }
                }
            })

            // setup an abstract state for the tabs directive
            .state("app.tabs", {
                "url": "/tabs",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "contests");
                    }
                },
                "views": {
                    "menuContent": {
                        "templateUrl": "templates/tabs.html"
                    }
                }

            })

            .state("app.tabs.myContests", {
                "url": "/myContests",
                "params": {"userClick": null},
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "myContests");
                    }
                },
                "views": {
                    "myContestsTab": {
                        "templateUrl": "templates/contests.html",
                        "controller": "ContestsCtrl"
                    }
                },
                "data": {
                    "exitApp" : true,
                    "serverTab": "mine",
                    "showPlay": true,
                    "showParticipants": false,
                    "title": "MY_CONTESTS"
                }
            })

            .state("app.tabs.runningContests", {
                "url": "/runningContests",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "runningContests");
                    }
                },
                "views": {
                    "runningContestsTab": {
                        "templateUrl": "templates/contests.html",
                        "controller": "ContestsCtrl"
                    }
                },
                data: {
                    "exitApp" : true,
                    "serverTab": "running",
                    "showPlay": true,
                    "showParticipants": false,
                    "title": "RUNNING_CONTESTS"
                }
            })

            .state("app.tabs.recentlyFinishedContests", {
                "url": "/recentlyFinishedContests",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "recentlyFinishedContests");
                    }
                },
                "views": {
                    "leaderboardTab": {
                        "templateUrl": "templates/contests.html",
                        "controller": "ContestsCtrl"
                    }
                },
                "data": {
                    "exitApp" : true,
                    "serverTab": "recentlyFinished",
                    "showPlay": false,
                    "showParticipants": true,
                    "title": "LEADERBOARDS"
                }
            })

            .state("app.tabs.friendsLeaderboard", {
                "url": "/friendsLeaderboard",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "friends");
                    }
                },
                "views": {
                    "leaderboardTab": {
                        "templateUrl": "templates/friendsLeaderboard.html",
                        "controller": "FriendsLeaderboardCtrl"
                    }
                },
                "data" : {
                    "exitApp" : true
                }
            })

            .state("app.tabs.weeklyLeaderboard", {
                "url": "/weeklyLeaderboard",
                "resolve": {
                    "auth": function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "weekly");
                    }
                },
                "views": {
                    "leaderboardTab": {
                        "templateUrl": "templates/weeklyLeaderboard.html",
                        "controller": "WeeklyLeaderboardCtrl"
                    }
                },
                "data" : {
                    "exitApp" : true
                }
            });

        $urlRouterProvider.otherwise(function ($injector, $location) {
            var $state = $injector.get("$state");
            $state.go("otherwise");
        });
    })

    .directive("mustBeDifferent", function () {
        return {
            require: "ngModel",
            scope: {
                otherModelValues: "=mustBeDifferent"
            },
            link: function (scope, element, attributes, ngModel) {

                ngModel.$validators.mustBeDifferent = function (modelValue) {
                    if (modelValue && scope.otherModelValues) {
                        for (var i = 0; i < scope.otherModelValues.length; i++) {
                            if (modelValue && scope.otherModelValues[i].$modelValue && modelValue.trim() === scope.otherModelValues[i].$modelValue.trim()) {
                                return false;
                            }
                        }
                        return true;
                    }
                    else {
                        return true;
                    }
                };

                scope.$watch("otherModelValues", function () {
                    ngModel.$validate();
                });
            }
        };
    })

    .directive("animationend", function () {
        return {
            restrict: "A",
            scope: {
                animationend: "&"
            },
            link: function (scope, element) {
                var callback = scope.animationend(),
                    events = "animationend webkitAnimationEnd MSAnimationEnd";

                element.on(events, function (event) {
                    callback.call(element[0], element[0], event);
                });
            }
        };
    })

    .directive("mytransitionend", function () {
        return {
            restrict: "A",
            scope: {
                mytransitionend: "&"
            },
            link: function (scope, element) {
                var callback = scope.mytransitionend(),
                    events = "animationend webkitAnimationEnd MSAnimationEnd" + "transitionend webkitTransitionEnd";

                element.on(events, function (event) {
                    callback.call(element[0], element[0], event);
                });
            }
        };
    })

    .directive("resize", function ($window) {
        return function (scope, element) {
            var w = angular.element($window);

            w.bind("resize", function () {
                scope.$broadcast("whoSmarter-windowResize");
                scope.$apply();
            });
        }
    })

    .directive("orientationchange", function ($window) {
        return function (scope, element) {
            var w = angular.element($window);

            w.bind("orientationchange", function () {
                scope.$broadcast("whoSmarter-orientationChanged");
                scope.$apply();
            });
        }
    })

    .directive("scopeFormLevel", function () {
        return {
            restrict: "A",
            require: "form",
            link: function (scope, element, attrs, formCtrl) {
                var currentScope = scope;
                var level = parseInt(attrs.scopeFormLevel, 10);
                for (var i = 0; i < level; i++) {
                    currentScope = currentScope.$parent;
                    if (!currentScope) {
                        break;
                    }
                }

                //Let the top level scope (as level was set) hold a pointer to this form
                if (currentScope) {
                    currentScope[element[0].name] = formCtrl;
                }
            }
        }
    })

    .directive("tabsSwipable", ["$ionicGesture", function ($ionicGesture) {
        //
        // make ionTabs swipable. leftswipe -> nextTab, rightswipe -> prevTab
        // Usage: just add this as an attribute in the ionTabs tag
        // <ion-tabs tabs-swipable> ... </ion-tabs>
        //
        return {
            restrict: "A",
            require: "ionTabs",
            link: function (scope, elm, attrs, tabsCtrl) {
                var onSwipeLeft = function () {
                    var target = tabsCtrl.selectedIndex() + 1;
                    if (target < tabsCtrl.tabs.length) {
                        scope.$apply(tabsCtrl.select(target));
                        scope.$broadcast("whoSmarter-tabChanged");
                    }
                };
                var onSwipeRight = function () {
                    var target = tabsCtrl.selectedIndex() - 1;
                    if (target >= 0) {
                        scope.$apply(tabsCtrl.select(target));
                        scope.$broadcast("whoSmarter-tabChanged");
                    }
                };

                var swipeGesture;
                if (attrs.dir === "rtl") {
                    swipeGesture = $ionicGesture.on("swipeleft", onSwipeRight, elm).on("swiperight", onSwipeLeft);
                }
                else {
                    swipeGesture = $ionicGesture.on("swipeleft", onSwipeLeft, elm).on("swiperight", onSwipeRight);
                }

                scope.$on("$destroy", function () {
                    $ionicGesture.off(swipeGesture, "swipeleft", onSwipeLeft);
                    $ionicGesture.off(swipeGesture, "swiperight", onSwipeRight);
                });
            }
        };
    }])

    .directive("analyticsOn", function () {
        function isCommand(element) {
            return ["a:", "button:", "button:button", "button:submit", "input:button", "input:submit"].indexOf(
                    element.tagName.toLowerCase() + ":" + (element.type || "")) >= 0;
        }

        function inferEventType(element) {
            if (isCommand(element)) return "click";
            return "click";
        }

        function inferEventName(element) {
            if (isCommand(element)) return element.innerText || element.value;
            return element.id || element.name || element.tagName;
        }

        function isProperty(name) {
            return name.substr(0, 9) === "analytics" && ["On", "Event", "If", "Properties", "EventType"].indexOf(name.substr(9)) === -1;
        }

        function propertyName(name) {
            var s = name.slice(9); // slice off the 'analytics' prefix
            if (typeof s !== "undefined" && s !== null && s.length > 0) {
                return s.substring(0, 1).toLowerCase() + s.substring(1);
            }
            else {
                return s;
            }
        }

        return {
            restrict: "A",
            link: function ($scope, $element, $attrs) {
                var eventType = $attrs.analyticsOn || inferEventType($element[0]);
                var trackingData = {};

                angular.forEach($attrs.$attr, function (attr, name) {
                    if (isProperty(name)) {
                        trackingData[propertyName(name)] = $attrs[name];
                        $attrs.$observe(name, function (value) {
                            trackingData[propertyName(name)] = value;
                        });
                    }
                });

                angular.element($element[0]).bind(eventType, function ($event) {
                    var eventName = $attrs.analyticsEvent || inferEventName($element[0]);
                    trackingData.eventType = $event.type;

                    if ($attrs.analyticsIf) {
                        if (!$scope.$eval($attrs.analyticsIf)) {
                            return; // Cancel this event if we don't pass the analytics-if condition
                        }
                    }
                    // Allow components to pass through an expression that gets merged on to the event properties
                    // eg. analytics-properites='myComponentScope.someConfigExpression.$analyticsProperties'
                    if ($attrs.analyticsProperties) {
                        angular.extend(trackingData, $scope.$eval($attrs.analyticsProperties));
                    }
                    FlurryAgent.logEvent(eventName, trackingData);
                });
            }
        }
    })

    .filter("orderObjectBy", function () {
        return function (items, field, reverse) {
            var filtered = [];
            angular.forEach(items, function (item) {
                filtered.push(item);
            });
            filtered.sort(function (a, b) {
                return (a[field] > b[field] ? 1 : -1);
            });
            if (reverse) filtered.reverse();
            return filtered;
        };
    });
