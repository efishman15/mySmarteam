angular.module('eddy1.services', [])

    //User Service
    .factory('UserService', function (store) {
        var service = this;

        service.initUser = function () {
            return {"email": null, "password": null};
        };

        service.setCurrentUser = function (user) {
            store.set('user', user);
            return user;
        };

        service.getCurrentUser = function () {
                return store.get('user');
        };

        return service;
    })

    //Login Service
    .factory('LoginService', function ($http, $rootScope, ENDPOINT_URI) {

        var service = this;
        var path = 'users/';

        service.getUrl = function () {
            return ENDPOINT_URI + path;
        };

        service.getActionUrl = function (action) {
            return service.getUrl() + action;
        };

        service.register = function (credentials, callbackOnSuccess, callbackOnError) {
            return $http.post(service.getActionUrl('register'), credentials)
                .success(function (data, status, headers, config) {
                    $http.defaults.headers.common.Authorization = data.token;
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    callbackOnError(status, data);
                })
        };

        service.login = function (credentials, callbackOnSuccess, callbackOnError) {
            $http.post(service.getActionUrl('login'), credentials)
                .success(function (data, status, headers, config) {
                    $http.defaults.headers.common.Authorization = data.token;
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    callbackOnError(status, data);
                })
        };

        service.logout = function (callbackOnSuccess, callbackOnError) {
            return $http.post(service.getActionUrl('logout'))
                .success(function (data, status, headers, config) {
                    delete $http.defaults.headers.common.Authorization;
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    delete $http.defaults.headers.common.Authorization;
                    callbackOnError(status, data);
                })
        };

        //Used for both login and register forms - clear last server error upon field change
        service.fieldChange = function (currentField, serverErrorField) {

            if (serverErrorField) {
                if (!serverErrorField.$error) {
                    serverErrorField.$error = {};
                }

                serverErrorField.$error.serverError = false;
            }

            if (currentField) {
                if (!currentField.$error) {
                    currentField.$error = {};
                }
                currentField.$error.serverError = false;
            }
        };

        return service;
    })

    //Quiz Service
    .factory('QuizService', function ($http, ENDPOINT_URI) {

        var service = this;

        var path = 'quiz/';

        service.getActionUrl = function (action) {
            return service.getUrl() + action;
        };

        service.getUrl = function () {
            return ENDPOINT_URI + path;
        };

        service.start = function (callbackOnSuccess, callbackOnError) {
            return $http.post(service.getActionUrl('start'))
                .success(function (data, status, headers, config) {
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    callbackOnError(status, data);
                })
        };

        return service;
    })

    //Error Service
    .factory('ErrorService', function () {

        var service = this;

        service.logError = function (status, error, displayAlert) {
            var message = "Error " + status + ": " + error.message;
            console.log(message);
            if (displayAlert && displayAlert == true) {
                alert(message);
            }
        };

        return service;
    });

