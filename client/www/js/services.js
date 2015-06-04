angular.module('eddy1.services', [])

    .factory('SessionsService', function ($http, ENDPOINT_URI) {

        var service = this;
        var path = 'sessions/';

        service.getUrl = function () {
            return ENDPOINT_URI + path;
        };

        service.getSessions = function (callbackOnSuccess, callbackOnError) {
            $http.get(service.getUrl())
                .success(function (data, status, headers, config) {
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    console.log("Error occurred.  Status:" + status);
                    callbackOnError(status);
                });
        };

        service.getSession = function (sessionId, callbackOnSuccess, callbackOnError) {
            $http.get(service.getUrl() + sessionId)
                .success(function (data, status, headers, config) {
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    console.log("Error occurred.  Status:" + status);
                    callbackOnError(status);
                });
        };

        return service;
    })

    //User Service
    .factory('UserService', function (store) {
        var service = this;
        var currentUser = null;

        service.initUser = function() {
            return {"email": null, "password": null, "token": null};
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
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    console.log("Error occurred.  Status:" + status);
                    callbackOnError(status);
                })};

        service.login = function (credentials, callbackOnSuccess, callbackOnError) {
            $http.post(service.getLogUrl('login'), credentials)
                .success(function (data, status, headers, config) {
                    $http.defaults.headers.common.Authorization = data.token;
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    console.log("Error occurred.  Status:" + status);
                    callbackOnError(status);
                })};

        service.logout = function (callbackOnSuccess, callbackOnError) {
            return $http.post(service.getLogUrl('logout'))
                .success(function (data, status, headers, config) {
                    delete $http.defaults.headers.common.Authorization;
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    console.log("Error occurred.  Status:" + status);
                    delete $http.defaults.headers.common.Authorization;
                    callbackOnError(status);
                })};

        return service;
    });