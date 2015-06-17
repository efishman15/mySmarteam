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
    .factory('LoginService', function ($http, ApiService) {

        var service = this;
        var path = 'users/';

        service.register = function (credentials, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "register", credentials, callbackOnSuccess, callbackOnError)
                .success(function (data, status, headers, config) {
                    $http.defaults.headers.common.Authorization = data.token;
                });
        };

        service.login = function (credentials, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "login", credentials, callbackOnSuccess, callbackOnError)
                .success(function (data, status, headers, config) {
                    $http.defaults.headers.common.Authorization = data.token;
                });
        };

        service.logout = function (callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "logout", credentials, callbackOnSuccess, callbackOnError)
                .success(function (data, status, headers, config) {
                    delete headers["Authorization"];
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    delete headers["Authorization"];
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
    .factory('QuizService', function ($http, ApiService) {

        var service = this;

        var path = 'quiz/';

        service.start = function (callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "start", null, callbackOnSuccess, callbackOnError)
        };

        service.answer = function (answer, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "answer", answer, callbackOnSuccess, callbackOnError)
        };

        service.nextQuestion = function (callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "nextQuestion", null, callbackOnSuccess, callbackOnError)
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
    })

    //Error Service
    .factory('MyAuthService', function () {

        var service = this;

        service.confirmLogin = function (token, config) {
            config.headers['Authorization'] = token;
            return config;
        };

        return service;
    })

    //Api Service
    .factory('ApiService', function ($http, ENDPOINT_URI) {

        var service = this;

        function getActionUrl(path, action) {
            return getUrl(path) + action;
        };

        function getUrl(path) {
            return ENDPOINT_URI + path;
        };

        service.post = function (path, action, postData, callbackOnSuccess, callbackOnError) {
            return $http.post(getActionUrl(path, action), postData)
                .success(function (data, status, headers, config) {
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    callbackOnError(status, data);
                })
        };

        return service;
    })




