// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('studyB4.app', ['studyB4.services', 'studyB4.controllers', 'angular-storage', 'ui.router', 'ionic', 'http-auth-interceptor', 'ngMessages'])
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

    .run(function ($rootScope, $ionicLoading) {
        $rootScope.$on('loading:show', function () {
            $ionicLoading.show({template: 'Loading...'})
        })

        $rootScope.$on('loading:hide', function () {
            $ionicLoading.hide()
        })
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
    .config(function ($stateProvider, $urlRouterProvider, $injector) {

        $stateProvider
            .state('app', {
                url: "/app",
                abstract: true,
                templateUrl: "templates/menu.html",
                controller: 'AppCtrl'
            })

            .state('app.home', {
                url: "/home",
                views: {
                    'menuContent': {
                        controller: "HomeCtrl",
                        templateUrl: "templates/home.html"
                    }
                }
            })

            .state('app.register', {
                url: '/register',
                views: {
                    'menuContent': {
                        controller: "RegisterCtrl",
                        templateUrl: "templates/register.html"
                    }
                }
            })

            .state('app.login', {
                url: '/login',
                views: {
                    'menuContent': {
                        controller: "LoginCtrl",
                        templateUrl: "templates/login.html"
                    }
                }
            })

            .state('app.play', {
                url: "/play",
                resolve: {
                    auth: function resolveAuthentication(LoginService) {
                        return LoginService.resolveAuthentication();
                    }
                },
                views: {
                    'menuContent': {
                        templateUrl: "templates/play.html",
                        controller: 'PlayCtrl'
                    }
                }
            })

            .state('app.quiz', {
                url: "/quiz",
                resolve: {
                    auth: function resolveAuthentication(LoginService) {
                        return LoginService.resolveAuthentication();
                    }
                },
                params: {subjectId: null},
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
                    auth: function resolveAuthentication(LoginService) {
                        return LoginService.resolveAuthentication();
                    }
                },
                params: {score: null},
                views: {
                    'menuContent': {
                        templateUrl: "templates/quizResult.html",
                        controller: 'QuizResultCtrl'
                    }
                }
            })

            .state('app.otherwise', {
                url: "/otherwise",
                views: {
                    'menuContent': {
                        templateUrl: "templates/play.html",
                        controller: 'OtherwiseCtrl'
                    }
                }
            })

            .state('app.logout', {
                url: "/logout",
                views: {
                    'menuContent': {
                        controller: "LogoutCtrl"
                    }
                }
            });

        $urlRouterProvider.otherwise(function ($injector, $location) {
            var $state = $injector.get('$state');
            var UserService = $injector.get('UserService');
            var user = UserService.getStoreUser();
            if (user && user.email) {
                return 'app/play';
            }
            else {
                return 'app/home';
            }
        });
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
    });