angular.module('studyB4.services', [])

    //User Service
    .factory('UserService', function (store, GeoInfoService, ErrorService, $rootScope, ApiService) {
        var service = this;
        var path = 'users/';

        service.getStoreUser = function () {
            return store.get("user");
        };

        service.setStoreUser = function (user) {
            store.set('user', user);
            return user;
        };

        service.clearStoreUser = function () {
            store.set('user', null);
        };

        service.initUser = function (callbackOnSuccess, callbackOnError) {

            GeoInfoService.getGeoInfo(function (geoResult) {
                    $rootScope.user = {
                        "email": null,
                        "password": null,
                        "direction": geoResult.direction,
                        "settings": {
                            "sound": true,
                            "protected": true,
                            "interfaceLanguage": geoResult.language,
                            "questionsLanguage": geoResult.language
                        }
                    };
                    $rootScope.isLoggedOn = false;
                    service.setStoreUser($rootScope.user);

                    if (callbackOnSuccess) {
                        callbackOnSuccess();
                    }
                },
                callbackOnError
            )
        };

        service.saveSettingsToServer = function (settings, callbackOnSuccess, callbackOnError) {
            ApiService.post(path, "settings", settings, callbackOnSuccess, callbackOnError);
        }

        return service;
    })

    //geoInfo service
    .factory('GeoInfoService', function ($http, ApiService, $rootScope) {

        var service = this;
        var path = 'info/';

        service.getGeoInfo = function (callbackOnSuccess, callbackOnError) {
            return ApiService.get("http://freegeoip.net/json/",
                function (geoInfo) {
                    $rootScope.geoInfo = geoInfo;
                    return ApiService.post(path, "geo", geoInfo,
                        function (geoResult) {
                            geoResult.geoInfo = geoInfo;
                            if (callbackOnSuccess) {
                                callbackOnSuccess(geoResult);
                            }
                        },
                        function (status, data) {
                            if (callbackOnError) {
                                callbackOnError(status, geoInfo);
                            }
                        })
                },
                callbackOnError)
        }

        return service;
    })

    //Login Service
    .factory('LoginService', function ($q, $rootScope, $http, $state, ApiService, UserService, MyAuthService, authService, ErrorService, $translate) {

        var service = this;
        var path = 'users/';

        service.register = function (user, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "register", user,
                function (data) {
                    //Was set just in order to pass it to the server - no need to save this in the Store
                    delete $rootScope.user["geoInfo"];

                    saveUser(user, data);
                    callbackOnSuccess()

                },
                function (status, data) {
                    callbackOnError(status, data);
                })
        };

        service.login = function (user, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "login", user,
                function (data) {
                    saveUser(user, data);
                    callbackOnSuccess(data);

                },
                function (status, data) {
                    callbackOnError(status, data);
                })
        };

        service.logout = function (callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "logout", null,
                function (data, headers) {
                    delete headers["Authorization"];
                    delete $http.defaults.headers.common["Authorization"];
                    $rootScope.isLoggedOn == false;
                    UserService.clearStoreUser();
                    UserService.initUser(callbackOnSuccess, callbackOnError);
                },
                function (status, data, headers) {
                    delete headers["Authorization"];
                    delete $http.defaults.headers.common["Authorization"];
                    $rootScope.isLoggedOn == false;
                    UserService.clearStoreUser();
                    UserService.initUser(callbackOnSuccess, callbackOnError);
                }
            )
        };

        service.resolveAuthentication = function (initUser) {

            var deferred = $q.defer();

            if (initUser && initUser == true) {
                if (!$rootScope.user) {
                    UserService.initUser(function () {
                        deferred.resolve();
                        $translate.use($rootScope.user.settings.interfaceLanguage);
                    }, function () {
                        deferred.resolve()
                        $translate.use($rootScope.user.settings.interfaceLanguage);
                    });
                }
                else {
                    deferred.resolve();
                }
                return deferred.promise;
            }

            if ($rootScope.isLoggedOn == true) {
                deferred.resolve();
                return deferred.promise;
            }

            $rootScope.user = UserService.getStoreUser();
            if ($rootScope.user && $rootScope.user.email) {
                service.login($rootScope.user,
                    function (data) {
                        deferred.resolve();
                        $translate.use($rootScope.user.settings.interfaceLanguage);
                    },
                    function (status, error) {
                        deferred.resolve();
                        $translate.use($rootScope.user.settings.interfaceLanguage);
                        ErrorService.logError(status, error);
                        UserService.initUser();
                    }
                )
            }
            else {
                UserService.initUser(function () {
                    deferred.resolve()
                    $translate.use($rootScope.user.settings.interfaceLanguage);
                }, function () {
                    deferred.resolve();
                    $translate.use($rootScope.user.settings.interfaceLanguage);
                });
            }
            return deferred.promise;
        };

        function saveUser(user, serverData) {
            $http.defaults.headers.common.Authorization = serverData.token;

            $rootScope.isLoggedOn = true;

            $rootScope.user = user;
            $rootScope.user.direction = serverData.direction;
            $rootScope.user.settings = serverData.settings;
            UserService.setStoreUser($rootScope.user);
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

    //Play Service
    .factory('PlayService', function ($http, ApiService) {

        var service = this;

        var path = 'quiz/';

        service.getSubjects = function (callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "subjects", null, callbackOnSuccess, callbackOnError)
        };

        return service;
    })

    //Quiz Service
    .factory('QuizService', function ($http, ApiService) {

        var service = this;

        var path = 'quiz/';

        service.start = function (subjectId, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "start", {"subjectId": subjectId}, callbackOnSuccess, callbackOnError)
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
    .factory('ErrorService', function ($ionicPopup) {

        var service = this;

        service.logError = function (status, error) {
            var errorMessage = "Error " + status + ": " + error.message;
            console.log(errorMessage);
            return errorMessage;
        };

        service.logErrorAndAlert = function (status, error) {
            var errorMessage = service.logError(status, error);
            $ionicPopup.alert({title: "Oops...", template: errorMessage});
            return errorMessage;
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
                    callbackOnSuccess(data, headers);
                })
                .error(function (data, status, headers, config) {
                    callbackOnError(status, data, headers);
                })
        };

        service.get = function (path, callbackOnSuccess, callbackOnError) {
            return $http.get(path)
                .success(function (data, status, headers, config) {
                    callbackOnSuccess(data);
                })
                .error(function (data, status, headers, config) {
                    if (callbackOnError) {
                        callbackOnError(status, data);
                    }
                })
        };

        return service;
    })
