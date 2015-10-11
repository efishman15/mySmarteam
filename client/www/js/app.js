// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('whoSmarter.app', ['whoSmarter.services', 'whoSmarter.controllers', 'ui.router', 'ionic', 'http-auth-interceptor', 'ngMessages', 'pascalprecht.translate', 'ng-fusioncharts', 'ezfb', 'ionic-datepicker', 'angular-storage', 'ngCordova'])
    .constant('ENDPOINT_URI', 'http://www.whosmarter.com/')
    .constant('ENDPOINT_URI_SECURED', 'https://www.whosmarter.com/')
    .run(function ($ionicPlatform, $rootScope) {
        $ionicPlatform.ready(function () {
                // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
                // for form inputs)
                if (window.cordova && window.cordova.plugins.Keyboard) {
                    cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
                }

                if (window.cordova) {
                    cordova.getAppVersion(function (version) {
                        if ($rootScope.user && $rootScope.user.clientInfo) {
                            $rootScope.user.clientInfo.appVersion = version;
                        }
                        else {
                            $rootScope.appVersion = version;
                        }
                    });

                    //Hook into window.open
                    window.open = cordova.InAppBrowser.open;
                }

                if (window.StatusBar) {
                    // org.apache.cordova.statusbar required
                    StatusBar.styleDefault();
                }

                if (ionic.Platform.isAndroid() && typeof inappbilling !== "undefined") {
                    inappbilling.init(function (resultInit) {
                            console.log("IAB Initialized");
                        },
                        function (errorInit) {
                            console.log("ERROR -> " + errorInit);
                        }
                        ,
                        {
                            showLog: true
                        }
                        ,
                        []
                    );
                }

                FlurryAgent.myLogError = function(errorType, message) {
                    FlurryAgent.logError(errorType.substring(0,255), message.substring(0,255), 0);
                }

                //FlurryAgent.setDebugLogEnabled(true);
                FlurryAgent.startSession("NT66P8Q5BR5HHVN2C527");

                // Fallback where requestAnimationFrame or its equivalents are not supported in the current browser
                window.myRequestAnimationFrame = (function(){
                    return window.requestAnimationFrame    ||
                        window.webkitRequestAnimationFrame ||
                        window.mozRequestAnimationFrame    ||
                        function( callback ){
                            window.setTimeout(callback, 1000 / 60);
                        };
                })();

            }
        );
    })

    .config(function ($httpProvider, $translateProvider) {
        $httpProvider.interceptors.push(function ($rootScope, $q) {
            return {
                request: function (config) {
                    $rootScope.$broadcast('whoSmarter-httpRequest', config)
                    return config;
                },
                response: function (response) {
                    $rootScope.$broadcast('whoSmarter-httpResponse', response)
                    return response;
                },
                responseError: function (rejection) {
                    $rootScope.$broadcast('whoSmarter-httpResponseError', rejection)
                    return $q.reject(rejection);
                }
            }
        })
    })

    .config(function ($ionicConfigProvider) {
        $ionicConfigProvider.backButton.text("");
        $ionicConfigProvider.backButton.previousTitleText("");
        $ionicConfigProvider.tabs.position('bottom');
    })

    .config(function (ezfbProvider) {
        if (!window.cordova) {
            ezfbProvider.setInitParams({
                // This is my FB app id for plunker demo app
                appId: '344342552056',

                // Module default is `v2.0`.
                // If you want to use Facebook platform `v2.3`, you'll have to add the following parameter.
                // https://developers.facebook.com/docs/javascript/reference/FB.init
                version: 'v2.5'
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
        $translateProvider.useSanitizeValueStrategy('escaped');
        $translateProvider.useStaticFilesLoader({
            prefix: 'languages/',
            suffix: '.json'
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
            .state('home', {
                url: "/home",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "home");
                    }
                },
                controller: "HomeCtrl",
                templateUrl: "templates/home.html"
            })

            .state('serverPopup', {
                url: "/serverPopup",
                params: {serverPopup: null},
                controller: "ServerPopupCtrl",
                templateUrl: "templates/serverPopup.html"
            })

            .state('questionStats', {
                url: "/questionStats",
                params: {serverPopup: null},
                controller: "ServerPopupCtrl",
                templateUrl: "templates/serverPopup.html"
            })

            .state('facebookCanvas', {
                url: "/facebook?connected&signedRequest&language",
                controller: "FacebookCanvasCtrl",
                params: {connected: null, signedRequest: null, language: null},
                resolve: {
                    auth: function resolveAuthentication(UserService, $stateParams) {
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
                url: "/otherwise",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "otherwise");
                    }
                },
                controller: "OtherwiseCtrl"
            })

            .state('share', {
                url: "/share",
                params: {serverPopup: null},
                controller: "ShareCtrl",
                templateUrl: "templates/share.html"
            })

            .state('contestParticipants', {
                url: "/contestParticipants",
                cache: false,
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "contestParticipants");
                    }
                },
                params: {contest: null},
                controller: "ContestParticipantsCtrl",
                templateUrl: "templates/contestParticipants.html"
            })

            .state('app.quiz', {
                url: "/quiz",
                cache: false,
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "quiz");
                    }
                },
                params: {contestId: null, teamId: null},
                views: {
                    'menuContent': {
                        templateUrl: "templates/quiz.html",
                        controller: 'QuizCtrl'
                    }
                }
            })

            .state('contest', {
                url: "/contest",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "contest");
                    }
                },
                cache: false,
                templateUrl: "templates/contest.html",
                controller: "ContestCtrl",
                params: {mode: null, contest: null}
            })

            .state('payPalPaymentSuccess', {
                url: "/payPalPaymentSuccess?token&PayerID",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "payPalPaymentSuccess");
                    }
                },
                controller: "PayPalPaymentSuccessCtrl",
                params: {token: null, PayerID: null}
            })

            .state('payment', {
                url: "/payment?purchaseMethod&purchaseSuccess&token&PayerID",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "payment");
                    }
                },
                templateUrl: "templates/payment.html",
                controller: "PaymentCtrl",
                params: {
                    token: null,
                    PayerID: null,
                    productId: null,
                    purchaseMethod: null,
                    purchaseSuccess: null,
                    nextView: null,
                    featurePurchased: null
                }
            })

            .state('settings', {
                url: "/settings",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "settings");
                    }
                },
                templateUrl: "templates/settings.html",
                controller: "SettingsCtrl"
            })

            .state('logout', {
                url: "/logout",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "logout");
                    }
                },
                controller: "LogoutCtrl"
            })

            .state('app', {
                url: "/app",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "menu");
                    }
                },
                abstract: true,
                templateUrl: "templates/menu.html",
                controller: 'AppCtrl'
            })

            // setup an abstract state for the tabs directive
            .state('app.tabs', {
                url: "/tabs",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "contests");
                    }
                },
                views: {
                    "menuContent": {
                        templateUrl: "templates/tabs.html"
                    }
                }

            })

            .state('app.tabs.myContests', {
                url: '/myContests',
                params: {userClick: null},
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "myContests");
                    }
                },
                views: {
                    'myContestsTab': {
                        templateUrl: 'templates/contests.html',
                        controller: 'ContestsCtrl'
                    }
                },
                appData: {"serverTab": "mine", "showPlay": true, "showParticipants": false, title: "MY_CONTESTS"}
            })

            .state('app.tabs.runningContests', {
                url: '/runningContests',
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "runningContests");
                    }
                },
                views: {
                    'runningContestsTab': {
                        templateUrl: 'templates/contests.html',
                        controller: 'ContestsCtrl'
                    }
                },
                appData: {
                    "serverTab": "running",
                    "showPlay": true,
                    "showParticipants": false,
                    title: "RUNNING_CONTESTS"
                }
            })

            .state('app.tabs.recentlyFinishedContests', {
                url: '/recentlyFinishedContests',
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "recentlyFinishedContests");
                    }
                },
                views: {
                    'leaderboardTab': {
                        templateUrl: 'templates/contests.html',
                        controller: 'ContestsCtrl'
                    }
                },
                appData: {
                    "serverTab": "recentlyFinished",
                    "showPlay": false,
                    "showParticipants": true,
                    title: "LEADERBOARDS"
                }
            })

            .state('app.tabs.friendsLeaderboard', {
                url: '/friendsLeaderboard',
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "friends");
                    }
                },
                views: {
                    'leaderboardTab': {
                        templateUrl: 'templates/friendsLeaderboard.html',
                        controller: 'FriendsLeaderboardCtrl'
                    }
                }
            })

            .state('app.tabs.weeklyLeaderboard', {
                url: '/weeklyLeaderboard',
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(null, "weekly");
                    }
                },
                views: {
                    'leaderboardTab': {
                        templateUrl: 'templates/weeklyLeaderboard.html',
                        controller: 'WeeklyLeaderboardCtrl'
                    }
                }
            });

        $urlRouterProvider.otherwise(function ($injector, $location) {
            var $state = $injector.get("$state");
            $state.go("otherwise");
        });
    })

    .directive('mustBeDifferent', function () {
        return {
            require: "ngModel",
            scope: {
                otherModelValue: "=mustBeDifferent"
            },
            link: function (scope, element, attributes, ngModel) {

                ngModel.$validators.mustBeDifferent = function (modelValue) {
                    if (modelValue && scope.otherModelValue) {
                        return modelValue.trim() != scope.otherModelValue.$modelValue.trim();
                    }
                    else {
                        return true;
                    }
                };

                scope.$watch("otherModelValue", function () {
                    ngModel.$validate();
                });
            }
        };
    })

    .directive('animationend', function () {
        return {
            restrict: 'A',
            scope: {
                animationend: '&'
            },
            link: function (scope, element) {
                var callback = scope.animationend(),
                    events = 'animationend webkitAnimationEnd MSAnimationEnd';

                element.on(events, function (event) {
                    callback.call(element[0], element[0], event);
                });
            }
        };
    })

    .directive('mytransitionend', function () {
        return {
            restrict: 'A',
            scope: {
                mytransitionend: '&'
            },
            link: function (scope, element) {
                var callback = scope.mytransitionend(),
                    events = 'animationend webkitAnimationEnd MSAnimationEnd' + 'transitionend webkitTransitionEnd';

                element.on(events, function (event) {
                    callback.call(element[0], element[0], event);
                });
            }
        };
    })

    .directive('resize', function ($window) {
        return function (scope, element) {
            var w = angular.element($window);

            w.bind('resize', function () {
                scope.$broadcast("whoSmarter-windowResize");
                scope.$apply();
            });
        }
    })

    .directive('orientationchange', function ($window) {
        return function (scope, element) {
            var w = angular.element($window);

            w.bind('orientationchange', function () {
                scope.$broadcast("whoSmarter-orientationChanged");
                scope.$apply();
            });
        }
    })

    .directive('tabsSwipable', ['$ionicGesture', function ($ionicGesture) {
        //
        // make ionTabs swipable. leftswipe -> nextTab, rightswipe -> prevTab
        // Usage: just add this as an attribute in the ionTabs tag
        // <ion-tabs tabs-swipable> ... </ion-tabs>
        //
        return {
            restrict: 'A',
            require: 'ionTabs',
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
                    swipeGesture = $ionicGesture.on('swipeleft', onSwipeRight, elm).on('swiperight', onSwipeLeft);
                }
                else {
                    swipeGesture = $ionicGesture.on('swipeleft', onSwipeLeft, elm).on('swiperight', onSwipeRight);
                }

                scope.$on('$destroy', function () {
                    $ionicGesture.off(swipeGesture, 'swipeleft', onSwipeLeft);
                    $ionicGesture.off(swipeGesture, 'swiperight', onSwipeRight);
                });
            }
        };
    }])

    .filter('orderObjectBy', function () {
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
