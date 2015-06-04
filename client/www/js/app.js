// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('eddy1.app', ['eddy1.services', 'eddy1.controllers', 'angular-storage', 'ui.router', 'ionic', 'http-auth-interceptor', 'ngMessages'])
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

    .config(function ($stateProvider, $urlRouterProvider) {

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

            .state('app.sessions', {
                url: "/sessions",
                views: {
                    'menuContent': {
                        templateUrl: "templates/sessions.html",
                        controller: 'SessionsCtrl'
                    }
                }
            })

            .state('app.session', {
                url: "/sessions/:sessionId",
                views: {
                    'menuContent': {
                        templateUrl: "templates/session.html",
                        controller: 'SessionCtrl'
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

        // if none of the above states are matched, use this as the fallback
        $urlRouterProvider.otherwise('/app/home');
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
    });