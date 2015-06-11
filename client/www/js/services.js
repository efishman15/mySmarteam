angular.module('eddy1.services', [])

    //User Service
    .factory('UserService', function (store) {
        var service = this;
        var currentUser = null;

        service.initUser = function() {
            return {"email": null, "password": null};
        };

        service.setCurrentUser = function (user) {
            currentuser = user;
            store.set('user', user);
            return currentUser;
        };

        service.getCurrentUser = function () {
            if (!currentUser) {
                currentUser = store.get('user');
            }
            return currentUser;
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

        service.getLogUrl = function (action) {
            return service.getUrl() + action;
        };

        service.register = function (credentials, callbackOnSuccess, callbackOnError) {
            return $http.post(service.getLogUrl('register'), credentials)
                .success(function (data, status, headers, config) {
                    $http.defaults.headers.common.Authorization = data.token;
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    callbackOnError(status, data);
                })};

        service.login = function (credentials, callbackOnSuccess, callbackOnError) {
            $http.post(service.getLogUrl('login'), credentials)
                .success(function (data, status, headers, config) {
                    $http.defaults.headers.common.Authorization = data.token;
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    callbackOnError(status, data);
                })};

        service.logout = function (callbackOnSuccess, callbackOnError) {
            return $http.post(service.getLogUrl('logout'))
                .success(function (data, status, headers, config) {
                    delete $http.defaults.headers.common.Authorization;
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    delete $http.defaults.headers.common.Authorization;
                    callbackOnError(status);
                })};

        //Used for both login and register forms - clear last server error upon field change
        service.fieldChange =  function (currentField, serverErrorField) {

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
    });