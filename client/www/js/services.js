angular.module('mySmarteam.services', [])

    //User Service
    .factory('UserService', function ($q, $rootScope, $http, $state, ApiService, $translate, MyAuthService, authService, ErrorService, $translate, InfoService, FacebookService, $ionicHistory, $ionicLoading) {

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
        service.initUser = function (callbackOnSuccess) {

            InfoService.getGeoInfo(function (geoResult, geoInfo) {
                    $rootScope.user = {
                        "settings": {
                            "language": geoResult.language,
                            "timezoneOffset": (new Date).getTimezoneOffset()
                        },
                        "geoInfo": geoInfo //For registration on the server
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
        service.facebookServerConnect = function (callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "facebookConnect", {"user": $rootScope.user},
                function (session) {
                    $http.defaults.headers.common.Authorization = session.token;
                    if ($rootScope.user.settings.language != session.settings.language) {
                        $translate.use(session.settings.language);
                    }
                    $rootScope.user.settings = session.settings;
                    $rootScope.session = session;
                    callbackOnSuccess(session);
                },
                function (status, data) {
                    callbackOnError(status, data);
                }, config)
        };

        //Invoke Facebook Client UI and then connect to the server
        service.facebookClientConnect = function (callbackOnSuccess, callbackOnError) {
            FacebookService.login(function (response) {
                service.setFacebookCredentials(response.authResponse)
                service.facebookServerConnect(callbackOnSuccess, callbackOnError);
            }, callbackOnError, ["public_profile", "email"]);

        };

        //Logout
        service.logout = function (callbackOnSuccess, callbackOnError, config) {
            FacebookService.logout(function (response) {
                return ApiService.post(path, "logout", null,
                    function (data, headers) {
                        clearDataAfterLogout(headers, callbackOnSuccess, callbackOnError);
                    },
                    function (status, data, headers) {
                        clearDataAfterLogout(headers, callbackOnSuccess, callbackOnError);
                    },
                    config
                )
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
                //-- Normal flow - first time load
                //-------------------------------------------------------------------------
                service.initUser(function () {

                    //------------------------------------------------------------------------------------
                    //-- Load languages from server - can be done without waiting for result
                    //------------------------------------------------------------------------------------
                    if (!$rootScope.settings) {
                        InfoService.getSettings(
                            function (data) {
                                $rootScope.settings = data;

                                //Define core events and functions to be used in the app
                                $rootScope.$on('$translateChangeEnd', function (data) {
                                    $rootScope.$broadcast("mySmarteam-languageChanged");
                                });

                                $rootScope.$on("mySmarteam-httpRequest", function (error, config) {
                                    if (!config || config.blockUserInterface !== false) {
                                        $ionicLoading.show({
                                                template: "<span dir='" + $rootScope.settings.languages[$rootScope.user.settings.language].direction + "'>" + $translate.instant("LOADING") + "</span>"
                                            }
                                        )
                                    }
                                });

                                $rootScope.$on("mySmarteam-httpResponse", function (error, config) {
                                    if (!config || config.blockUserInterface !== false) {
                                        $ionicLoading.hide();
                                    }
                                });

                                $rootScope.$on("mySmarteam-httpResponseError", function (error, rejection) {
                                    if (!rejection.config || rejection.config.blockUserInterface !== false) {
                                        $ionicLoading.hide();
                                    }
                                    if (rejection.data instanceof Object && rejection.data.type && rejection.status != 401) {
                                        if (rejection.config && rejection.config.onServerErrors && rejection.data.type && rejection.config.onServerErrors[rejection.data.type]) {
                                            //Caller has set a function to be invoked after user presses ok on the alert
                                            rejection.data.onTap = rejection.config.onServerErrors[rejection.data.type].next;
                                            ErrorService.alert(rejection.data);
                                        }
                                        else {
                                            ErrorService.alert(rejection.data)
                                        }
                                    }
                                });

                                $rootScope.$on("event:auth-loginRequired", function (error, rejection) {
                                    service.getLoginStatus(function (success) {
                                            service.facebookServerConnect(
                                                function (data) {
                                                    authService.loginConfirmed(null, function (config) {
                                                        return MyAuthService.confirmLogin(data.token, config);
                                                    });
                                                },
                                                function (status, error) {
                                                    $rootScope.gotoView("home");
                                                }
                                            )
                                        },
                                        function (error) {
                                            $rootScope.gotoView("home");
                                        });
                                });

                                $rootScope.gotoView = function (viewName, isRootView, params, clearHistory) {

                                    if (isRootView == null) {
                                        isRootView = true;
                                    }

                                    if (!params) {
                                        params = {};
                                    }

                                    if (isRootView == true) {

                                        if (clearHistory == null) {
                                            clearHistory = true;
                                        }

                                        if (clearHistory == true) {
                                            $ionicHistory.clearHistory();
                                        }
                                        $ionicHistory.nextViewOptions({
                                            disableBack: true,
                                            historyRoot: clearHistory
                                        });
                                    }

                                    $state.go(viewName, params, {reload: true, inherit: true, location: true});

                                };

                                service.getLoginStatus(resolveQueue, resolveQueue);
                            })
                    }
                    else {
                        resolveQueue();
                    }
                });
            }

            return deferred.promise;
        };

        //Save settings to server
        service.saveSettingsToServer = function (postData, callbackOnSuccess, callbackOnError, config) {
            ApiService.post(path, "settings", postData, callbackOnSuccess, callbackOnError, config);
        }

        //Toggle sound to server
        service.toggleSound = function (callbackOnSuccess, callbackOnError, config) {
            ApiService.post(path, "toggleSound", null, callbackOnSuccess, callbackOnError, config);
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
            var language = navigator.languages ? navigator.languages[0] : (navigator.language || navigator.userLanguage)
            if (!language) {
                language = "en";
            }
            if (language.length > 2) {
                language = language.toLowerCase().substring(0, 2);
            }

            return {"language": language};

        }

        //Get geo info - never fails - always has a default
        service.getGeoInfo = function (callbackOnSuccess, geoProviderId) {
            var config = {"timeout": 2000}
            if (!geoProviderId) {
                geoProviderId = 0;
            }

            ApiService.get(geoProviders[geoProviderId],
                function (geoInfo) {
                    return ApiService.post(path, "geo", geoInfo,
                        function (geoResult) {
                            geoResult.geoInfo = geoInfo;
                            if (callbackOnSuccess) {
                                callbackOnSuccess(geoResult, geoInfo);
                            }
                        },
                        function () {
                            callbackOnSuccess(getDefaultLanguage(), geoInfo);
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
                }, config);
        };


        //Get settings from server
        service.getSettings = function (callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "settings", null,
                function (data) {
                    if (callbackOnSuccess) {
                        callbackOnSuccess(data);
                    }
                },
                function (status, data) {
                    if (callbackOnError) {
                        callbackOnError(status, data);
                    }
                }, config)
        };

        return service;

    })

    //Sound Service.
    .factory('ContestsService', function ($http, ApiService, $rootScope, $translate) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = 'contests/';

        var canvas = document.createElement("canvas");
        var canvasContext = canvas.getContext("2d");
        canvasContext.font = $rootScope.settings.charts.contestAnnotations.annotationsFont;

        //add contest
        service.addContest = function (postData, callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "add", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Set Contest
        service.setContest = function (postData, callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "set", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Remove Contest
        service.removeContest = function (postData, callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "remove", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Get Contests
        service.getContests = function (postData, callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "get", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Join Contest
        service.joinContest = function (postData, callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "join", postData, callbackOnSuccess, callbackOnError, config)
        };

        service.prepareContestChart = function (contest) {
            var contestCaption = $translate.instant("WHO_IS_SMARTER");
            var contestChart = JSON.parse(JSON.stringify($rootScope.settings.charts.chartObject));
            contestChart.contest = contest;

            contestChart.data = [];
            var teamsOrder;

            var contestEndTerm
            if (contest.status != "finished") {
                contestEndTerm = "CONTEST_ENDS_IN";
            }
            else {
                contestEndTerm = "CONTEST_ENDED";
            }
            var contestEndString = $translate.instant(contestEndTerm, {
                number: contest.endsInNumber,
                units: $translate.instant(contest.endsInUnits)
            });

            var contestEndsWidth = canvasContext.measureText(contestEndString).width;
            var contestParticipantsString = $translate.instant("CONTEST_PARTICIPANTS", {participants: contest.participants + contest.manualParticipants});
            var contestParticipantsWidth = canvasContext.measureText(contestParticipantsString).width;

            var direction = $rootScope.settings.languages[$rootScope.user.settings.language].direction;
            var magicNumbers = $rootScope.settings.charts.contestAnnotations.annotationHorizontalMagicNumbers[direction];

            contestChart.annotations.groups[0].items[magicNumbers.endsIn.id].text = contestEndString;
            contestChart.annotations.groups[0].items[magicNumbers.endsIn.id].x = magicNumbers.endsIn.position + (contestEndsWidth / 2 + magicNumbers.endsIn.spacing);

            contestChart.annotations.groups[0].items[magicNumbers.participants.id].text = contestParticipantsString;
            contestChart.annotations.groups[0].items[magicNumbers.participants.id].x = magicNumbers.participants.position + (contestParticipantsWidth / 2 + magicNumbers.participants.spacing);

            if ($rootScope.settings.languages[$rootScope.user.settings.language].direction == "ltr") {
                teamsOrder = [0, 1];
            }
            else {
                teamsOrder = [1, 0];
            }

            contestChart.data.push({
                "label": contest.teams[teamsOrder[0]].name,
                "value": contest.teams[teamsOrder[0]].chartValue,
            });
            contestChart.data.push({
                "label": contest.teams[teamsOrder[1]].name,
                "value": contest.teams[teamsOrder[1]].chartValue
            });

            var labelRootProperty;
            if (contest.myTeam == 0 || contest.myTeam == 1) {
                contestChart.data[teamsOrder[contest.myTeam]].labelFontBold = true;
            }

            contestChart.chart.caption = contestCaption;
            contestChart.chart.subCaption = $translate.instant("CONTEST_NAME", {
                team0: contest.teams[0].name,
                team1: contest.teams[1].name
            });

            return contestChart;
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
        service.start = function (postData, callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "start", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Answer a quiz question
        service.answer = function (postData, callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "answer", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Get next question
        service.nextQuestion = function (callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "nextQuestion", null, callbackOnSuccess, callbackOnError, config)
        };

        return service;
    })

    //Error Service
    .factory('ErrorService', function ($ionicPopup, $translate, $rootScope) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        //ionic alert popup
        service.alert = function (error) {
            if (error) {
                if (error.type) {
                    if (!error.additionalInfo) {
                        error.additionalInfo = {};
                    }
                    return $ionicPopup.alert({
                        cssClass: $rootScope.settings.languages[$rootScope.user.settings.language].direction,
                        title: $translate.instant(error.type + "_TITLE"),
                        template: $translate.instant(error.type + "_MESSAGE", error.additionalInfo),
                        buttons : [{"text" : $translate.instant("OK"), "type" : "button-positive", "onTap" : error.onTap}]
                    });
                }
                else {
                    return $ionicPopup.alert({
                        cssClass: $rootScope.settings.languages[$rootScope.user.settings.language].direction,
                        template: error,
                        okText: $translate.instant("OK")
                    });
                }
            }
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
        service.get = function (path, callbackOnSuccess, callbackOnError, config) {
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
        service.post = function (path, action, postData, callbackOnSuccess, callbackOnError, config) {
            return $http.post(getActionUrl(path, action), postData, config)
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
    })

    //Sound Service
    .factory('SoundService', function () {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var audio = new Audio();
        var playOgg = !!(audio.canPlayType && audio.canPlayType('audio/ogg; codecs="vorbis"').replace(/no/, ''));
        var playMp3 = !!(audio.canPlayType && audio.canPlayType('audio/mpeg').replace(/no/, ''));

        //Play
        service.play = function (sound) {
            if (playMp3) {
                audio.src = sound + ".mp3";
                audio.load();
                audio.play();
                return true;
            }
            else if (playOgg) {
                audio.src = sound + ".ogg";
                ;
                audio.load();
                audio.play();
                return true;
            }
            else {
                return false;
            }
        };

        return service;
    });