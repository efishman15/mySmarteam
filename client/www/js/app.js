// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('mySmarteam.app', ['mySmarteam.services', 'mySmarteam.controllers', 'angular-storage', 'ui.router', 'ionic', 'http-auth-interceptor', 'ngMessages', 'pascalprecht.translate', 'ng-fusioncharts'])
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

    .config(function ($httpProvider) {
        $httpProvider.interceptors.push(function ($rootScope, $q) {
            return {
                request: function (config) {
                    $rootScope.$broadcast('loading:show')
                    return config;
                },
                response: function (response) {
                    $rootScope.$broadcast('loading:hide')
                    return response;
                },
                responseError: function (rejection) {
                    $rootScope.$broadcast('loading:hide')
                    return $q.reject(rejection);
                }
            }
        })
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

    .config(function ($stateProvider, $urlRouterProvider, $locationProvider) {

        $stateProvider
            .state('app', {
                url: "/app",
                abstract: true,
                templateUrl: "templates/menu.html",
                controller: 'AppCtrl',
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication();
                    }
                },
            })

            .state('app.home', {
                url: "/home",
                resolve: {
                    auth: function resolveAuthentication(UserService) {
                        return UserService.resolveAuthentication(true);
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
                        return UserService.resolveAuthentication();
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
                        return UserService.resolveAuthentication();
                    }
                },
                params: {contestId: null},
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
                        return UserService.resolveAuthentication();
                    }
                },
                params: {score: null, contest: null},
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
                        return UserService.resolveAuthentication();
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
                        return UserService.resolveAuthentication();
                    }
                },
                views: {
                    'menuContent': {
                        templateUrl: "templates/settings.html",
                        controller: "SettingsCtrl"
                    }
                }
            })

            .state('app.otherwise', {
                url: "/otherwise",
                auth: function resolveAuthentication(UserService) {
                    return UserService.resolveAuthentication();
                },
                views: {
                    'menuContent': {
                        controller: "OtherwiseCtrl"
                    }
                }
            });


        $urlRouterProvider.otherwise("/app/otherwise");

        //$locationProvider.html5Mode(true);

    })

    .directive('myCompareTo', function () {
        return {
            require: "ngModel",
            scope: {
                otherModelValue: "=myCompareTo"
            },
            link: function (scope, element, attributes, ngModel) {

                ngModel.$validators.myCompareTo = function (modelValue) {
                    return modelValue == scope.otherModelValue.$modelValue;
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
