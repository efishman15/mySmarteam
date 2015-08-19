angular.module('mySmarteam.services', [])

    //User Service
    .factory('UserService', function ($q, $rootScope, $http, $state, ApiService, MyAuthService, authService, ErrorService, $translate, InfoService) {

        var service = this;
        var path = 'user/';

        service.initUser = function (callbackOnSuccess, callbackOnError) {

            InfoService.getGeoInfo(function (geoResult) {
                    $rootScope.user = {
                        "settings": {
                            "language": geoResult.language
                        }
                    };
                    $rootScope.session = null;

                    if (callbackOnSuccess) {
                        callbackOnSuccess();
                    }
                },
                callbackOnError
            )
        };

        service.getMyFacebookProfile = function (success, callbackOnSuccess, callbackOnError) {
            facebookConnectPlugin.api("/me", [],
                function (user) {
                    $rootScope.user.name = user.name;
                    $rootScope.user.image = "http://graph.facebook.com/" + user.id + "picture?type=square";
                    $rootScope.user.facebookAccessToken = success.authResponse.accessToken;

                    if (callbackOnSuccess) {
                        callbackOnSuccess(success);
                    }
                },
                function (error) {
                    if (callbackOnError) {
                        callbackOnError("Error getting facebook profile info");
                    }
                });
        };

        service.getLoginStatus = function (callbackOnSuccess, callbackOnError) {
            facebookConnectPlugin.getLoginStatus(function (success) {
                    if (success.authResponse && success.status && success.status == "connected") {
                        if (!$rootScope.user || !$rootScope.user.facebookAccessToken) {
                            service.initUser(function () {
                                service.getMyFacebookProfile(success, callbackOnSuccess, callbackOnError);
                            },
                                function() {
                                    if (callbackOnSuccess) {
                                        callbackOnSuccess(success);
                                    }
                                })
                        }
                        else {
                            if (callbackOnSuccess) {
                                callbackOnSuccess(success);
                            }
                        }
                    }
                    else {
                        if (callbackOnError) {
                            callbackOnError("not connected");
                        }
                    }
                },
                function (error) {
                    if (callbackOnError) {
                        callbackOnError(error)
                    }
                });
        }

        service.facebookServerConnect = function (callbackOnSuccess, callbackOnError) {
            callbackOnSuccess();
            return;
            return ApiService.post(path, "facebookConnect", {"accessToken": $rootScope.user.facebookAccessToken},
                function (session) {
                    $http.defaults.headers.common.Authorization = session.token;
                    $rootScope.session = session;
                    callbackOnSuccess(session);
                },
                function (status, data) {
                    callbackOnError(status, data);
                })
        };

        service.facebookClientConnect = function (callbackOnSuccess, callbackOnError) {
            facebookConnectPlugin.login(["public_profile", "email", "user_friends"],
                function (success) {
                    service.getMyFacebookProfile(success, function (success) {
                            service.facebookServerConnect(callbackOnSuccess, callbackOnError);
                        },
                        function (error) {
                            if (callbackOnError) {
                                callbackOnError(error);
                            }
                        })
                });
        };

        service.logout = function (callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "logout", null,
                function (data, headers) {
                    clearDataAfterLogout(callbackOnSuccess, callbackOnError);
                },
                function (status, data, headers) {
                    clearDataAfterLogout(callbackOnSuccess, callbackOnError);
                }
            )
        };

        service.resolveAuthentication = function (initUser) {

            var deferred = $q.defer();

            //----------------------------------------------------
            //-- Load languages from server - first time
            //----------------------------------------------------
            if (!$rootScope.languages) {
                InfoService.getLanguages(
                    function (data) {
                        $rootScope.languages = data;
                    },
                    ErrorService.logErrorAndAlert)
            }

            //-------------------------------------------------------------------------
            //-- Init mode requested - for home screen, in un-Authenticated mode
            //-------------------------------------------------------------------------
            if (initUser && initUser == true) {
                if (!$rootScope.user) {
                    doInit(deferred);
                }
                else {
                    deferred.resolve();
                }
                return deferred.promise;
            }

            if ($rootScope.session || ($rootScope.user && $rootScope.user.facebookAccessToken)) {
                deferred.resolve();
                return deferred.promise;
            }

            //-------------------------------------------------------------------------
            //-- Normal flow - try performing auto login
            //-------------------------------------------------------------------------
            service.getLoginStatus(function (success) {
                    service.facebookServerConnect(function (data) {
                            deferred.resolve();
                            $translate.use($rootScope.user.settings.language);
                        },
                        function (status, error) {
                            ErrorService.logError(status, error);
                            doInit(deferred);
                        }
                    )
                },
                function (error) {
                    doInit(deferred);
                });

            return deferred.promise;
        };

        service.saveSettingsToServer = function (postData, callbackOnSuccess, callbackOnError) {
            ApiService.post(path, "settings", postData, callbackOnSuccess, callbackOnError);
        }

        service.toggleSound = function (callbackOnSuccess, callbackOnError) {
            ApiService.post(path, "toggleSound", null, callbackOnSuccess, callbackOnError);
        }

        function clearDataAfterLogout(callbackOnSuccess, callbackOnError) {
            delete headers["Authorization"];
            delete $http.defaults.headers.common["Authorization"];
            $rootScope.session = null;
            UserService.initUser(callbackOnSuccess, callbackOnError);
        }

        function doInit(deferred) {
            service.initUser(function () {
                if (deferred) {
                    deferred.resolve()
                }
                $translate.use($rootScope.user.settings.language);
            }, function () {
                if (deferred) {
                    deferred.resolve();
                }
                $translate.use($rootScope.user.settings.language);
            });
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
                    cssClass: $rootScope.languages[$rootScope.user.settings.language].direction,
                    title: $translate.instant(error.title),
                    template: $translate.instant(error.message),
                    okText: $translate.instant("OK")
                });
            }
            else {
                $ionicPopup.alert({
                    cssClass: $rootScope.languages[$rootScope.user.settings.language].direction,
                    template: error.message,
                    okText: $translate.instant("OK")
                });
            }
            return;
        };

        return service;
    })

    //MyAuthService Service
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
