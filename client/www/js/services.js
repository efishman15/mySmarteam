angular.module('mySmarteam.services', [])

    //User Service
    .factory('UserService', function (store, InfoService, ErrorService, $rootScope, ApiService) {
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

            InfoService.getGeoInfo(function (geoResult) {
                    $rootScope.storedUser = {
                        "email": null,
                        "password": null,
                        "settings": {
                            "interfaceLanguage": geoResult.language
                        }
                    };
                    $rootScope.session = null;
                    service.setStoreUser($rootScope.storedUser);

                    if (callbackOnSuccess) {
                        callbackOnSuccess();
                    }
                },
                callbackOnError
            )
        };

        service.saveSettingsToServer = function (postData, callbackOnSuccess, callbackOnError) {
            ApiService.post(path, "settings", postData, callbackOnSuccess, callbackOnError);
        }

        service.setProfile = function (postData, callbackOnSuccess, callbackOnError) {
            ApiService.post(path, "setProfile", postData, callbackOnSuccess, callbackOnError);
        }

        service.toggleSound = function (callbackOnSuccess, callbackOnError) {
            ApiService.post(path, "toggleSound", null, callbackOnSuccess, callbackOnError);
        }

        service.removeProfile = function (postData, callbackOnSuccess, callbackOnError) {
            ApiService.post(path, "removeProfile", postData, callbackOnSuccess, callbackOnError);
        }

        return service;
    })

    //Info service
    .factory('InfoService', function ($http, ApiService, $rootScope) {

        var service = this;
        var path = 'info/';

        service.getGeoInfo = function (callbackOnSuccess, callbackOnError) {
            return ApiService.get("http://www.telize.com/geoip",
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

        service.getLanguages = function (callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "languages", null,
                function (data) {
                    if (callbackOnSuccess) {
                        callbackOnSuccess(data);
                    }
                },
                function (status, data) {
                    if (callbackOnError) {
                        callbackOnError(status, data);
                    }
                })
        }

        return service;
    })

    //Login Service
    .factory('LoginService', function ($q, $rootScope, $http, $state, ApiService, UserService, MyAuthService, authService, ErrorService, $translate, InfoService) {

        var service = this;
        var path = 'users/';

        service.register = function (user, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "register", user,
                function (session) {
                    //Was set just in order to pass it to the server - no need to save this in the Store
                    delete $rootScope.storedUser["geoInfo"];

                    saveSession(session);
                    callbackOnSuccess()

                },
                function (status, data) {
                    callbackOnError(status, data);
                })
        };

        service.login = function (user, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "login", user,
                function (session) {
                    saveSession(session);
                    callbackOnSuccess(session);

                },
                function (status, data) {
                    callbackOnError(status, data);
                })
        };

        service.logout = function (logoutData, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "logout", logoutData,
                function (data, headers) {
                    delete headers["Authorization"];
                    delete $http.defaults.headers.common["Authorization"];
                    $rootScope.session = null;
                    UserService.clearStoreUser();
                    UserService.initUser(callbackOnSuccess, callbackOnError);
                },
                function (status, data, headers) {
                    delete headers["Authorization"];
                    delete $http.defaults.headers.common["Authorization"];
                    $rootScope.session = null;
                    UserService.clearStoreUser();
                    UserService.initUser(callbackOnSuccess, callbackOnError);
                }
            )
        };

        service.resolveAuthentication = function (initUser) {

            var deferred = $q.defer();

            if (!$rootScope.languages) {
                InfoService.getLanguages(
                    function (data) {
                        $rootScope.languages = data;
                    },
                    ErrorService.logErrorAndAlert)
            }

            if (initUser && initUser == true) {
                if (!$rootScope.storedUser) {
                    UserService.initUser(function () {
                        deferred.resolve();
                        $translate.use($rootScope.storedUser.settings.interfaceLanguage);
                    }, function () {
                        deferred.resolve()
                        $translate.use($rootScope.storedUser.settings.interfaceLanguage);
                    });
                }
                else {
                    deferred.resolve();
                }
                return deferred.promise;
            }

            if ($rootScope.session) {
                deferred.resolve();
                return deferred.promise;
            }

            $rootScope.storedUser = UserService.getStoreUser();
            if ($rootScope.storedUser && $rootScope.storedUser.email) {
                service.login($rootScope.storedUser,
                    function (data) {
                        deferred.resolve();
                        $translate.use($rootScope.storedUser.settings.interfaceLanguage);
                    },
                    function (status, error) {
                        deferred.resolve();
                        $translate.use($rootScope.storedUser.settings.interfaceLanguage);
                        ErrorService.logError(status, error);
                        UserService.initUser();
                    }
                )
            }
            else {
                UserService.initUser(function () {
                    deferred.resolve()
                    $translate.use($rootScope.storedUser.settings.interfaceLanguage);
                }, function () {
                    deferred.resolve();
                    $translate.use($rootScope.storedUser.settings.interfaceLanguage);
                });
            }
            return deferred.promise;
        };

        function saveSession(session) {
            $http.defaults.headers.common.Authorization = session.token;
            $rootScope.session = session;
            if (!$rootScope.storedUser.settings.passwordProtected) {
                $rootScope.storedUser.settings.passwordProtected = session.settings.passwordProtected;
                UserService.setStoreUser($rootScope.storedUser);
            }
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

        service.confirmPassword = function (password, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "confirmPassword", password,
                function (data) {
                    callbackOnSuccess(data);

                },
                function (status, data) {
                    callbackOnError(status, data);
                })
        };

        return service;

    })

    //Play Service
    .factory('PlayService', function ($http, $rootScope, ApiService, $translate) {

        var service = this;

        var path = 'quiz/';

        service.getSubjects = function (postData, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "subjects", postData, callbackOnSuccess, callbackOnError)
        };

        service.subjectList = function (availableSubjects) {
            if (!availableSubjects || availableSubjects.checked == 0) {
                return $translate.instant("SUBJECTS_CHOSEN_BEFORE_QUIZ");
            }
            else {
                var listOfSubjectNames = "";
                for (var i = 0; i < availableSubjects.subjects.length; i++) {
                    if (availableSubjects.subjects[i].checked == true) {
                        listOfSubjectNames += availableSubjects.subjects[i].displayNames[$rootScope.storedUser.settings.interfaceLanguage] + ","
                    }
                }
                return listOfSubjectNames.substring(0, listOfSubjectNames.length - 1);
            }
        }
        service.getSubjectsChooser = function(profile, callbackOnSuccess, callbackOnError) {
            this.getSubjects({"quizLanguage": profile.quizLanguage},
                function (subjects) {
                    var availableSubjects = {"checked": 0, "subjects": subjects};
                    var localSubjects = [];
                    if (profile.subjects && profile.subjects.length > 0) {
                        for (var i = 0; i < availableSubjects.subjects.length; i++) {
                            availableSubjects.subjects[i].checked = false;
                            for (var j = 0; j < profile.subjects.length; j++) {
                                if (availableSubjects.subjects[i].subjectId == profile.subjects[j]) {
                                    availableSubjects.subjects[i].checked = true;
                                    availableSubjects.checked++;
                                    localSubjects.push(availableSubjects.subjects[i].subjectId);
                                    break;
                                }
                            }
                        }
                    }
                    if (callbackOnSuccess) {
                        callbackOnSuccess({"availableSubjects" : availableSubjects, "localSubjects" : localSubjects})
                    }
                }
                , callbackOnError
            );
        }

        return service;
    })

    //Quiz Service
    .factory('QuizService', function ($http, ApiService) {

        var service = this;

        var path = 'quiz/';

        service.start = function (postData, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "start", postData, callbackOnSuccess, callbackOnError)
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
    .factory('ErrorService', function ($ionicPopup, $translate, $rootScope) {

        var service = this;

        service.logError = function (status, error) {
            var errorMessage = "Error " + status + ": " + $translate.instant(error.message);
            console.log(errorMessage);
            return errorMessage;
        };

        service.logErrorAndAlert = function (status, error) {
            if (error.title) {
                $ionicPopup.alert({
                    cssClass: $rootScope.languages[$rootScope.storedUser.settings.interfaceLanguage].direction,
                    title: $translate.instant(error.title),
                    template: $translate.instant(error.message),
                    okText: $translate.instant("OK")
                });
            }
            else {
                $ionicPopup.alert({
                    cssClass: $rootScope.languages[$rootScope.storedUser.settings.interfaceLanguage].direction,
                    template: error.message,
                    okText: $translate.instant("OK")
                });
            }
            return;
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
                    if (callbackOnSuccess) {
                        callbackOnSuccess(data, headers);
                    }
                })
                .error(function (data, status, headers, config) {
                    if (callbackOnError) {
                        callbackOnError(status, data, headers);
                    }
                })
        };

        service.get = function (path, callbackOnSuccess, callbackOnError) {
            return $http.get(path)
                .success(function (data, status, headers, config) {
                    if (callbackOnSuccess) {
                        callbackOnSuccess(data);
                    }
                })
                .error(function (data, status, headers, config) {
                    if (callbackOnError) {
                        callbackOnError(status, data);
                    }
                })
        };

        return service;
    })
