angular.module('mySmarteam.services', [])

    //User Service
    .factory('UserService', function ($q, $rootScope, $http, $state, ApiService, $translate, MyAuthService, authService, ErrorService, $translate, InfoService, FacebookService) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = 'user/';
        var resolveRequests = [];


        //----------------------------------------------
        // Service private functions
        //----------------------------------------------

        //Resolve all items in queue
        function resolveQueue() {
            while (resolveRequests.length > 0) {
                var item = resolveRequests.pop();
                item.resolve();
            }
        }

        //Clear data after logout
        function clearDataAfterLogout(headers, callbackOnSuccess, callbackOnError) {
            delete headers["Authorization"];
            delete $http.defaults.headers.common["Authorization"];
            service.initUser(callbackOnSuccess, callbackOnError);
        }


        //Init user
        service.initUser = function (callbackOnSuccess, callbackOnError) {

            InfoService.getGeoInfo(function (geoResult) {
                    $rootScope.user = {
                        "settings": {
                            "language": geoResult.language
                        }
                    };
                    $rootScope.session = null;

                    $translate.use($rootScope.user.settings.language);

                    if (callbackOnSuccess) {
                        callbackOnSuccess();
                    }
                }
            )
        };

        //Set Facebook Credentials from the facebook response
        service.setFacebookCredentials = function (facebookAuthResponse) {
            if (!$rootScope.user.thirdParty) {
                $rootScope.user.thirdParty = {};
            }
            $rootScope.user.thirdParty.type = "facebook";
            $rootScope.user.thirdParty.id = parseInt(facebookAuthResponse.userID, 10);
            $rootScope.user.thirdParty.accessToken = facebookAuthResponse.accessToken;
        };

        //Get Login Status
        service.getLoginStatus = function (callbackOnSuccess, callbackOnError) {

            FacebookService.getLoginStatus(function (response) {
                if (response.authResponse && response.status && response.status == "connected") {
                    if (!$rootScope.user || !$rootScope.user.thirdPary) {
                        service.setFacebookCredentials(response.authResponse);
                        service.facebookServerConnect(function () {
                            callbackOnSuccess(response);
                        }, callbackOnError);
                    }
                    else {
                        service.setFacebookCredentials(response.authResponse);
                        if (callbackOnSuccess) {
                            callbackOnSuccess(response);
                        }
                    }
                }
                else {
                    if (callbackOnError) {
                        callbackOnError(response.status);
                    }
                }
            }, callbackOnError);
        };

        //Connect to the server with the Facebook credentials
        service.facebookServerConnect = function (callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "facebookConnect", $rootScope.user,
                function (session) {
                    $http.defaults.headers.common.Authorization = session.token;
                    $rootScope.session = session;
                    callbackOnSuccess(session);
                },
                function (status, data) {
                    callbackOnError(status, data);
                })
        };

        //Invoke Facebook Client UI and then connect to the server
        service.facebookClientConnect = function (callbackOnSuccess, callbackOnError) {
            FacebookService.login(function(response) {
                service.setFacebookCredentials(response.authResponse)
                service.facebookServerConnect(callbackOnSuccess, callbackOnError);
            }, callbackOnError, ["public_profile", "email"]);

        };

        //Logout
        service.logout = function (callbackOnSuccess, callbackOnError) {
            FacebookService.logout(function (response) {
                return ApiService.post(path, "logout", null,
                    function (data, headers) {
                        clearDataAfterLogout(headers, callbackOnSuccess, callbackOnError);
                    },
                    function (status, data, headers) {
                        clearDataAfterLogout(headers, callbackOnSuccess, callbackOnError);
                    }
                ), ErrorService.logError
            });
        };

        //Resolve authentication - blocks all controllers until resolved
        //Handles multiple calls - with a queue
        service.resolveAuthentication = function (source) {

            var deferred = $q.defer();
            resolveRequests.push(deferred);

            if (resolveRequests.length > 1) {
                return resolveRequests[resolveRequests.length - 1].promise;
            }

            if ($rootScope.session || ($rootScope.user && $rootScope.user.thirdParty)) {
                resolveQueue();
                return deferred.promise;
            }
            else {
                //-------------------------------------------------------------------------
                //-- Normal flow - try performing auto login
                //-------------------------------------------------------------------------
                service.initUser(function () {

                    //----------------------------------------------------
                    //-- Load languages from server - can be done without waiting for result
                    //----------------------------------------------------
                    if (!$rootScope.languages) {
                        InfoService.getLanguages(
                            function (data) {
                                $rootScope.languages = data;
                                service.getLoginStatus(resolveQueue, resolveQueue);
                            },
                            ErrorService.logErrorAndAlert)
                    }
                });
            }

            return deferred.promise;
        };

        //Save settings to server
        service.saveSettingsToServer = function (postData, callbackOnSuccess, callbackOnError) {
            ApiService.post(path, "settings", postData, callbackOnSuccess, callbackOnError);
        }

        //Toggle sound to server
        service.toggleSound = function (callbackOnSuccess, callbackOnError) {
            ApiService.post(path, "toggleSound", null, callbackOnSuccess, callbackOnError);
        }

        return service;
    })

    //Info service
    .factory('InfoService', function ($http, ApiService, $rootScope) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = 'info/';

        var geoProviders = ["http://www.telize.com/geoip", "https://freegeoip.net/json"];

        //----------------------------------------------
        // Service private functions
        //----------------------------------------------

        //Get Default language
        function getDefaultLanguage() {
            //Always return a language - get the browser's language
            var language = navigator.languages? navigator.languages[0] : (navigator.language || navigator.userLanguage)
            if (!language) {
                language = "en";
            }
            if (languge.length > 2) {
                language = language.toLowerCase().substring(0,2);
            }

            return {"language" : language};

        }

        //Get geo info - never fails - always has a default
        service.getGeoInfo = function (callbackOnSuccess, geoProviderId) {
            var config = {"timeout": 2000}
            if (!geoProviderId) {
                geoProviderId = 0;
            }

            ApiService.get(geoProviders[geoProviderId], config,
                function (geoInfo) {
                    $rootScope.geoInfo = geoInfo;
                    return ApiService.post(path, "geo", geoInfo,
                        function (geoResult) {
                            geoResult.geoInfo = geoInfo;
                            if (callbackOnSuccess) {
                                callbackOnSuccess(geoResult);
                            }
                        },
                        function() {
                            callbackOnSuccess(getDefaultLanguage());
                        });
                },
                function (status, data) {
                    if (geoProviderId < geoProviders.length - 1) {
                        //Try another provider
                        return service.getGeoInfo(callbackOnSuccess, geoProviderId + 1);
                    }
                    else {
                        callbackOnSuccess(getDefaultLanguage());
                    }
                });
        };


        //Get languages from server
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
        };

        return service;

    })

    //Quiz Service.
    .factory('QuizService', function ($http, ApiService) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = 'quiz/';

        //Start quiz
        service.start = function (postData, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "start", postData, callbackOnSuccess, callbackOnError)
        };

        //Answer a quiz question
        service.answer = function (answer, callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "answer", answer, callbackOnSuccess, callbackOnError)
        };

        //Get next question
        service.nextQuestion = function (callbackOnSuccess, callbackOnError) {
            return ApiService.post(path, "nextQuestion", null, callbackOnSuccess, callbackOnError)
        };

        return service;
    })

    //Error Service
    .factory('ErrorService', function ($ionicPopup, $translate, $rootScope) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        //Log Error
        service.logError = function (status, error) {
            var errorMessage = "Error " + status + ": " + $translate.instant(error.message);
            console.log(errorMessage);
            return errorMessage;
        };

        //Log Error with ionic alert
        service.logErrorAndAlert = function (status, error) {
            if (error && error.title) {
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
                    template: error.message ? error.message : error,
                    okText: $translate.instant("OK")
                });
            }
            return;
        };

        return service;
    })

    //MyAuthService Service
    .factory('MyAuthService', function () {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        //Confirm login
        service.confirmLogin = function (token, config) {
            config.headers['Authorization'] = token;
            return config;
        };

        return service;
    })

    //Api Service
    .factory('ApiService', function ($http, ENDPOINT_URI) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        //----------------------------------------------
        // Service Private functions
        //----------------------------------------------

        //Get action Url
        function getActionUrl(path, action) {
            return getUrl(path) + action;
        }

        //Get Url
        function getUrl(path) {
            return ENDPOINT_URI + path;
        }

        //Get
        service.get = function (path, config, callbackOnSuccess, callbackOnError) {
            return $http.get(path, config)
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

        //Post
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

        return service;
    })

    //Facebook Service
    .factory('FacebookService', function (ezfb) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        //Login
        service.login = function (callbackOnSuccess, callbackOnError, permissions) {
            if (window.cordova) {
                window.cordova.exec(callbackOnSuccess, callbackOnError, "FacebookConnectPlugin", "login", permissions);
            }
            else {
                var permissionObject = {};
                if (permissions && permissions.length > 0) {
                    permissionObject.scope = permissions.toString();
                }
                ezfb.login(function (response) {
                    if (response.authResponse) {
                        callbackOnSuccess(response);
                    }
                    else if (callbackOnError) {
                        callbackOnError(response.status);
                    }
                }, permissionObject)
            }
        };

        //Get Login Status
        service.getLoginStatus = function (callbackOnSuccess, callbackOnError) {
            if (window.cordova) {
                window.cordova.exec(callbackOnSuccess, callbackOnError, "FacebookConnectPlugin", "getLoginStatus", []);
            }
            else {
                try {
                    ezfb.getLoginStatus(function (response) {
                        callbackOnSuccess(response);
                    });
                } catch (error) {
                    if (!callbackOnError) {
                        console.error(error.message);
                    } else {
                        callbackOnError(error.message);
                    }
                }
            }
        };

        //Logout
        service.logout = function (callbackOnSuccess, callbackOnError) {
            if (window.cordova) {
                window.cordova.exec(callbackOnSuccess, callbackOnError, "FacebookConnectPlugin", "logout", []);
            }
            else {
                try {
                    ezfb.logout(function (response) {
                        callbackOnSuccess(response);
                    });
                } catch (error) {
                    if (!callbackOnError) {
                        console.error(error.message);
                    } else {
                        callbackOnError(error.message);
                    }
                }
            }
        }

        return service;
    });
