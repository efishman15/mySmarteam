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
                    $rootScope.$broadcast('mySmarteam-httpRequest')
                    return config;
                },
                response: function (response) {
                    $rootScope.$broadcast('mySmarteam-httpResponse')
                    return response;
                },
                responseError: function (rejection) {
                    $rootScope.$broadcast('mySmarteam-httpResponseError', rejection.data)
                    return $q.reject(rejection);
                }
            }
        })
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

    .config(function ($stateProvider, $urlRouterProvider, $locationProvider) {

        $stateProvider
            .state('app', {
                url: "/app",
                abstract: true,
                templateUrl: "templates/menu.html",
                controller: 'AppCtrl',
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("menu");
                    }
                },
            })

            .state('app.home', {
                url: "/home",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("home");
                    }
                },
                views: {
                    'menuContent': {
                        controller: "HomeCtrl",
                        templateUrl: "templates/home.html"
                    }
                }
            })

            .state('app.contests', {
                url: "/contests",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("contests");
                    }
                },
                views: {
                    'menuContent': {
                        templateUrl: "templates/contests.html",
                        controller: 'ContestsCtrl'
                    }
                }
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
                        controller: 'QuizCtrl'
                    }
                }
            })

            .state('app.quizResult', {
                url: "/quizResult",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("quizResult");
                    }
                },
                cache: false,
                params: {results: null},
                views: {
                    'menuContent': {
                        templateUrl: "templates/quizResult.html",
                        controller: 'QuizResultCtrl'
                    }
                }
            })

            .state('app.logout', {
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
            })

            .state('app.settings', {
                url: "/settings",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("settings");
                    }
                },
                views: {
                    'menuContent': {
                        templateUrl: "templates/settings.html",
                        controller: "SettingsCtrl"
                    }
                }
            })

            .state('app.contest', {
                url: "/contest",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("contest");
                    }
                },
                params: {mode: null, contest: null},
                views: {
                    'menuContent': {
                        templateUrl: "templates/contest.html",
                        controller: "ContestCtrl"
                    }
                }
            })

            .state("app.otherwise", {
                url: "/otherwise",
                cache: false,
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication("otherwise");
                    }
                },
                views: {
                    'menuContent': {
                        controller: "OtherwiseCtrl"
                    }
                }
            })

        $urlRouterProvider.otherwise(function ($injector, $location) {
            var $state = $injector.get("$state");
            $state.go("app.otherwise");
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
