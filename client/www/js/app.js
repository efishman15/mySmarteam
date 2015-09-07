// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('mySmarteam.app', ['mySmarteam.services', 'mySmarteam.controllers', 'ui.router', 'ionic', 'http-auth-interceptor', 'ngMessages', 'pascalprecht.translate', 'ng-fusioncharts', 'angular-google-analytics', 'ezfb', 'ionic-datepicker'])
    .constant('ENDPOINT_URI', 'http://studyb4.ddns.net:7000/')
    .run(function ($ionicPlatform) {
        $ionicPlatform.ready(function () {
            // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
            // for form inputs)
            if (window.cordova && window.cordova.plugins.Keyboard) {
                cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
            }
            if (window.StatusBar) {
                // org.apache.cordova.statusbar required
                StatusBar.styleDefault();
            }
        });
    })

    .config(function ($httpProvider, $translateProvider) {
        $httpProvider.interceptors.push(function ($rootScope, $q) {
            return {
                request: function (config) {
                    $rootScope.$broadcast('mySmarteam-httpRequest', config)
                    return config;
                },
                response: function (response) {
                    $rootScope.$broadcast('mySmarteam-httpResponse', response.config)
                    return response;
                },
                responseError: function (rejection) {
                    $rootScope.$broadcast('mySmarteam-httpResponseError', rejection)
                    return $q.reject(rejection);
                }
            }
        })
    })

    .config(function($ionicConfigProvider) {
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
                version: 'v2.4'
            });
        }
    })

    /*
     .config(function (AnalyticsProvider) {
     // Set analytics account
     AnalyticsProvider.setAccount('UA-66555929-1');

     // Track all routes (or not)
     AnalyticsProvider.trackPages(true);

     // Track all URL query params (default is false)
     AnalyticsProvider.trackUrlParams(true);

     // Use display features plugin
     AnalyticsProvider.useDisplayFeatures(true);

     // Use analytics.js instead of ga.js
     AnalyticsProvider.useAnalytics(true);

     // Ignore first page view... helpful when using hashes and whenever your bounce rate looks obscenely low.
     AnalyticsProvider.ignoreFirstPageLoad(true);

     // Enable enhanced link attribution
     AnalyticsProvider.useEnhancedLinkAttribution(true);

     // Set custom cookie parameters for analytics.js
     AnalyticsProvider.setCookieConfig({
     cookieDomain: 'studyb4.ddns.net',
     cookieName: 'mySmarteamAnalytics',
     cookieExpires: 20000
     });

     // Change page event name
     AnalyticsProvider.setPageEvent('$stateChangeSuccess');

     // Delay script tag creation
     // must manually call Analytics.createScriptTag(cookieConfig) or Analytics.createAnalyticsScriptTag(cookieConfig)
     AnalyticsProvider.delayScriptTag(true);
     })

     .run(function (Analytics) {
     // In case you are relying on automatic page tracking, you need to inject Analytics
     // at least once in your application (for example in the main run() block)
     })
     */
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
                        return UserService.resolveAuthentication("home");
                    }
                },
                controller: "HomeCtrl",
                templateUrl: "templates/home.html"
            })

            .state("otherwise", {
                url: "/otherwise",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("otherwise");
                    }
                },
                controller: "OtherwiseCtrl"
            })

            .state('app.quiz', {
                url: "/quiz",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("quiz");
                    }
                },
                params: {contestId: null, teamId: null},
                views: {
                    'menuContent': {
                        templateUrl: "templates/quiz.html",
                        controller: 'QuizCtrl',
                    }
                }

            })

            .state('quizResult', {
                url: "/quizResult",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("quizResult");
                    }
                },
                templateUrl: "templates/quizResult.html",
                controller: 'QuizResultCtrl',
                cache: false,
                params: {results: null}
            })

            .state('contest', {
                url: "/contest",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("contest");
                    }
                },
                templateUrl: "templates/contest.html",
                controller: "ContestCtrl",
                params: {mode: null, contest: null}
            })

            .state('settings', {
                url: "/settings",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("settings");
                    }
                },
                templateUrl: "templates/settings.html",
                controller: "SettingsCtrl"
            })

            .state('app', {
                url: "/app",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("tab");
                    }
                },
                abstract: true,
                templateUrl: "templates/menu.html",
                controller: 'AppCtrl'
            })

            // setup an abstract state for the tabs directive
            .state('app.contests', {
                url: "/contests",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("tab");
                    }
                },
                views: {
                    "menuContent": {
                        templateUrl: "templates/tabs.html"
                    }
                }

            })

            .state('app.contests.mine', {
                url: '/mine',
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("contests");
                    }
                },
                views: {
                    'myContestsTab': {
                        templateUrl: 'templates/contests.html',
                        controller: 'ContestsCtrl'
                    }
                },
                appData: {"serverTab" : "mine", "showPlay" : true, "showParticipants" : false}
            })

            .state('app.contests.running', {
                url: '/running',
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("contests");
                    }
                },
                views: {
                    'runningContestsTab': {
                        templateUrl: 'templates/contests.html',
                        controller: 'ContestsCtrl'
                    }
                },
                appData: {"serverTab" : "running", "showPlay" : true, "showParticipants" : false}
            })

            .state('app.contests.recentlyFinished', {
                url: '/recentlyFinished',
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("contests");
                    }
                },
                views: {
                    'recentlyFinishedContestsTab': {
                        templateUrl: 'templates/contests.html',
                        controller: 'ContestsCtrl'
                    }
                },
                appData: {"serverTab" : "recentlyFinished", "showPlay" : false, "showParticipants" : true}
            })

            .state('logout', {
                url: "/logout",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("logout");
                    }
                },
                views: {
                    'menuContent': {
                        controller: "LogoutCtrl"
                    }
                }
            });

        $urlRouterProvider.otherwise(function ($injector, $location) {
            var $state = $injector.get("$state");
            $state.go("otherwise");
        });
    })

    .directive('animationend', function () {
        return {
            restrict: 'A',
            scope: {
                animationend: '&'
            },
            link: function (scope, element) {
                var callback = scope.animationend(),
                    events = 'animationend webkitAnimationEnd MSAnimationEnd' +
                        'transitionend webkitTransitionEnd';

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
                scope.$broadcast("mySmarteam-windowResize");
                scope.$apply();
            });
        }
    })

    .directive('orientationchange', function ($window) {
        return function (scope, element) {
            var w = angular.element($window);

            w.bind('orientationchange', function () {
                scope.$broadcast("mySmarteam-orientationChanged");
                scope.$apply();
            });
        }
    })

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
