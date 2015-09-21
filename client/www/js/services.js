angular.module('whoSmarter.services', [])

    //User Service
    .factory('UserService', function ($q, $rootScope, $http, $state, ApiService, MyAuthService, authService, PopupService, $translate, InfoService, FacebookService, $ionicHistory, $ionicLoading, $ionicConfig, $ionicPlatform) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = 'user/';
        var resolveRequests = [];
        var resolveEvents = [];

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

        //Broadcasts events in queue if any
        service.resolveEvents = function () {
            while (resolveEvents.length > 0) {
                var event = resolveEvents.pop();
                $rootScope.$broadcast(event.name, event.data);
            }
        }

        //Local init user - without server calls
        service.localInitUser = function (callbackOnSuccess, language, geoInfo) {

            $rootScope.user = {
                "settings": {
                    "language": language,
                    "timezoneOffset": (new Date).getTimezoneOffset()
                },
            };

            if (geoInfo) {
                $rootScope.user.geoInfo = geoInfo;
            }

            $translate.use($rootScope.user.settings.language);

            $rootScope.session = null;

            if (callbackOnSuccess) {
                callbackOnSuccess();
            }
        }

        //Init user
        service.initUser = function (callbackOnSuccess, language, geoInfo) {

            if (geoInfo && language) {
                service.localInitUser(callbackOnSuccess, geoResult.language, geoInfo);
            }
            else {
                InfoService.getGeoInfo(function (geoResult, geoInfo) {
                    service.localInitUser(callbackOnSuccess, geoResult.language, geoInfo);
                });
            }
        };

        //Set Facebook Credentials from the facebook response
        service.setFacebookCredentials = function (facebookAuthResponse) {
            if (!$rootScope.user.thirdParty) {
                $rootScope.user.thirdParty = {};
            }
            $rootScope.user.thirdParty.type = "facebook";
            $rootScope.user.thirdParty.id = facebookAuthResponse.userID;
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

                    if ($rootScope.settings.languages[$rootScope.session.settings.language].direction == "ltr") {
                        $ionicConfig.backButton.icon('ion-chevron-left');
                    }
                    else {
                        $ionicConfig.backButton.icon('ion-chevron-right');
                    }

                    callbackOnSuccess(session);
                },
                function (status, data) {
                    if (callbackOnError) {
                        callbackOnError(status, data);
                    }
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
        service.resolveAuthentication = function (resolveData, source) {

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

                        $ionicPlatform.registerBackButtonAction(function (event) {
                            if ($state.current.name.length >= 12 && $state.current.name.substring(0, 12) === "app.contests" && ionic.Platform.isAndroid()) {
                                PopupService.confirm("EXIT_APP_TITLE", "EXIT_APP_MESSAGE", null, function () {
                                    ionic.Platform.exitApp();
                                });
                            }
                            else if ($state.current.name == "serverPopup") {
                                event.preventDefault();
                            }
                            else {
                                if (navigator && navigator.app && navigator.app.backHistory) {
                                    navigator.app.backHistory();
                                }
                            }
                        }, 600);

                        if (ionic.Platform.isAndroid()) {
                            $rootScope.platform = "android";
                        }
                        else if (ionic.Platform.isIOS()) {
                            $rootScope.platform = "ios";
                        }
                        else if (window.self !== window.top) {
                            //running inside an iframe, e.g. facebook canvas
                            $rootScope.platform = "facebook";
                        }
                        else {
                            $rootScope.platform = "web";
                        }

                        //------------------------------------------------------------------------------------
                        //-- Load languages from server - can be done without waiting for result
                        //------------------------------------------------------------------------------------

                        //Define core events and functions to be used in the app
                        $rootScope.$on("whoSmarter-httpRequest", function (error, config) {
                            if (!config || config.blockUserInterface !== false) {
                                var direction;
                                if ($rootScope.settings) {
                                    direction = $rootScope.settings.languages[$rootScope.user.settings.language].direction;
                                }
                                else if ($rootScope.user.settings.language == "he") {
                                    //First time loading before settings retrieved from server
                                    direction = "rtl";
                                }
                                $ionicLoading.show({
                                        animation: 'fade-in',
                                        showBackdrop: true,
                                        showDelay: 50
                                    }
                                )
                            }
                        });

                        $rootScope.$on("whoSmarter-httpResponse", function (error, response) {
                            if (!response.config || response.config.blockUserInterface !== false) {
                                $ionicLoading.hide();
                            }
                            if (response.data.serverPopup) {
                                var event = {
                                    "name": "whoSmarter-serverPopup",
                                    "data": response.data.serverPopup
                                };
                                if (resolveRequests.length > 0) {
                                    resolveEvents.push(event);
                                }
                                else {
                                    $rootScope.$broadcast(event.name, event.data);
                                }
                            }
                        });

                        $rootScope.$on("whoSmarter-httpResponseError", function (error, rejection) {
                            if (!rejection.config || rejection.config.blockUserInterface !== false) {
                                $ionicLoading.hide();
                            }
                            if (rejection.data instanceof Object && rejection.data.type && rejection.status != 401) {
                                if (rejection.config && rejection.config.onServerErrors && rejection.data.type && rejection.config.onServerErrors[rejection.data.type]) {
                                    //Caller has set a function to be invoked after user presses ok on the alert
                                    rejection.data.onTap = rejection.config.onServerErrors[rejection.data.type].next;
                                    PopupService.alert(rejection.data);
                                }
                                else {
                                    PopupService.alert(rejection.data)
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

                        $rootScope.$on('$translateChangeEnd', function (data) {
                            $rootScope.$broadcast("whoSmarter-languageChanged");
                        });

                        $rootScope.gotoView = function (viewName, isRootView, params, clearHistory) {

                            if (isRootView == null) {
                                isRootView = true;
                            }

                            if (!params) {
                                params = {};
                            }

                            if (isRootView === true) {

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

                        $rootScope.gotoRootView = function () {
                            if ($rootScope.session || ($rootScope.user && $rootScope.user.thirdParty)) {
                                $rootScope.gotoView("app.contests.mine");
                            }
                            else {
                                $rootScope.gotoView("home");
                            }
                        };


                        $rootScope.$on("whoSmarter-serverPopup", function (error, data) {
                            $rootScope.gotoView("serverPopup", false, {serverPopup: data})
                        });

                        if (!$rootScope.settings) {
                            InfoService.getSettings(
                                function (data) {
                                    $rootScope.settings = data;

                                    if (!resolveData) {
                                        console.log(source + ":getLoginStatus");
                                        service.getLoginStatus(resolveQueue, resolveQueue);
                                    }
                                    else {
                                        if (resolveData.connected === "true") {
                                            $rootScope.user.thirdParty = {"signedRequest": resolveData.signedRequest}
                                            service.facebookServerConnect(resolveQueue, resolveQueue);
                                        }
                                        else {
                                            service.facebookClientConnect(resolveQueue, resolveQueue)
                                        }
                                    }
                                }
                            )
                        }
                        else {
                            resolveQueue();
                        }
                    }
                    ,
                    (resolveData && resolveData.language ? resolveData.language : null), null
                )
                ;
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

        var geoProviders = ["https://www.telize.com/geoip", "https://freegeoip.net/json"];

        //----------------------------------------------
        // Service private functions
        //----------------------------------------------

        //Get Default language
        service.getDefaultLanguage = function () {
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
            if (geoProviderId == null) {
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
                            callbackOnSuccess(service.getDefaultLanguage(), geoInfo);
                        });
                },
                function (status, data) {
                    if (geoProviderId < geoProviders.length - 1) {
                        //Try another provider
                        return service.getGeoInfo(callbackOnSuccess, geoProviderId + 1);
                    }
                    else {
                        callbackOnSuccess(service.getDefaultLanguage());
                    }
                }, config);
        };


        //Get settings from server
        service.getSettings = function (callbackOnSuccess, callbackOnError, config) {
            var postData = {};
            if (window.cordova) {
                postData.appVersion = $rootScope.appVersion;
                postData.platform = ionic.Platform.platform();
                postData.platformVersion = ionic.Platform.version();
            }
            postData.language = $rootScope.user.settings.language;

            return ApiService.post(path, "settings", postData,
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

        service.prepareContestChart = function (contest, contestIndex) {
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

            contestChart.contestIndex = contestIndex;

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
    .factory('PopupService', function ($ionicPopup, $translate, $rootScope) {

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
                        buttons: [{"text": $translate.instant("OK"), "type": "button-positive", "onTap": error.onTap}]
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

        //ionic confirm popup
        service.confirm = function (title, message, params, okFunction) {

            var okButton = {
                text: $translate.instant("OK"),
                type: 'button-positive',
                onTap: function (e) {
                    // Returning a value will cause the promise to resolve with the given value.
                    return "OK";
                }
            };
            var cancelButton = {
                text: $translate.instant("CANCEL"),
                type: 'button-default',
                onTap: function (e) {
                    return null;
                }
            };

            var buttons = [];
            buttons.push(okButton);
            buttons.push(cancelButton);

            var confirmPopup = $ionicPopup.confirm({
                title: $translate.instant(title, params),
                template: $translate.instant(message, params),
                cssClass: $rootScope.settings.languages[$rootScope.session.settings.language].direction,
                buttons: buttons
            });

            confirmPopup.then(function (res) {
                if (res) {
                    if (okFunction) {
                        okFunction();
                    }
                }
            })
        }


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
    .factory('ApiService', function ($http, ENDPOINT_URI, ENDPOINT_URI_SECURED) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        service.endPoint = (window.location.protocol != "https:" ? ENDPOINT_URI : ENDPOINT_URI_SECURED)

        //----------------------------------------------
        // Service Private functions
        //----------------------------------------------

        //Get action Url
        function getActionUrl(path, action) {
            return getUrl(path) + action;
        }

        //Get Url
        function getUrl(path) {
            return service.endPoint + path;
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
    .factory('SoundService', function ($rootScope) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var audio = new Audio();
        var playOgg = !!(audio.canPlayType && audio.canPlayType('audio/ogg; codecs="vorbis"').replace(/no/, ''));
        var playMp3 = !!(audio.canPlayType && audio.canPlayType('audio/mpeg').replace(/no/, ''));

        //Play
        service.play = function (sound) {
            if (!$rootScope.session.settings.sound || !$rootScope.session.settings.sound === false) {
                return;
            }

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
    })

    //Chart Service
    .factory('ChartService', function ($rootScope, $timeout, ContestsService) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        function teamClicked(scope, dataSource, teamId) {
            var serverTeamId = teamId;
            if ($rootScope.settings.languages[$rootScope.session.settings.language].direction == "rtl") {
                serverTeamId = 1 - teamId; //In RTL - the teams are presented backwards
            }

            //Show effect of joining the team on the client side before entering the quiz
            if (dataSource.contest.myTeam == null || dataSource.contest.myTeam != serverTeamId) {
                dataSource.contest.myTeam = serverTeamId;

                scope.$apply(function () {
                    scope.teamChanged = true;

                    //The caller must set this property as an array of charts in order to work with this reused peace of code
                    scope.contestCharts[dataSource.contestIndex] = ContestsService.prepareContestChart(dataSource.contest);
                });
            }
            else {
                $rootScope.gotoView("app.quiz", false, {contestId: dataSource.contest._id, teamId: serverTeamId});
            }
        }

        //setEvents
        service.setEvents = function (scope) {

            scope.$on("whoSmarter-teamClicked", function (error, data) {
                teamClicked(scope, data.dataSource, data.teamId)
            });

            scope.fcEvents = {
                "dataplotClick": function (eventObj, dataObj) {
                    scope.$broadcast("whoSmarter-teamClicked", {
                        "dataSource": eventObj.sender.args.dataSource,
                        "teamId": dataObj.dataIndex
                    });
                },
                "dataLabelClick": function (eventObj, dataObj) {
                    scope.$broadcast("whoSmarter-teamClicked", {
                        "dataSource": eventObj.sender.args.dataSource,
                        "teamId": dataObj.dataIndex
                    });
                },
                "annotationClick": function (eventObj, dataObj) {
                    if ($rootScope.session.isAdmin === true) {
                        $rootScope.gotoView("contest", false, {
                            mode: "edit",
                            contest: eventObj.sender.args.dataSource.contest
                        });
                    }
                },
                "drawComplete": function (eventObj, dataObj) {
                    if (scope.teamChanged == true) {
                        scope.teamChanged = false;

                        //Let the chart animation finish
                        $timeout(function () {
                            $rootScope.gotoView("app.quiz", false, {
                                contestId: eventObj.sender.args.dataSource.contest._id,
                                teamId: eventObj.sender.args.dataSource.contest.myTeam
                            });
                        }, 1000);
                    }
                }
            };
        };

        return service;
    })

    //Chart Service
    .factory('XpService', function ($rootScope) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        var canvas = null;
        var context = null;

        service.circle = Math.PI * 2;
        service.quarter = Math.PI / 2;

        var centerX;
        var centerY;

        service.initXp = function (canvas, context) {

            if (canvas && context) {
                service.canvas = canvas;
                service.context = context;
            }

            service.context.clearRect(0, 0, service.canvas.width, service.canvas.height);

            centerX = service.canvas.width / 2;
            centerY = service.canvas.height / 2;

            service.context.shadowOffsetX = $rootScope.settings.xpControl.shadow.offsetX;
            service.context.shadowOffsetY = $rootScope.settings.xpControl.shadow.offsetY;
            service.context.shadowBlur = $rootScope.settings.xpControl.shadow.blur;
            service.context.shadowColor = $rootScope.settings.xpControl.shadow.color;

            //-------------------------------------------------------------------------------------
            // Draw the full circle representing the entire xp required for the next level
            //-------------------------------------------------------------------------------------
            service.context.beginPath();

            service.context.arc(centerX, centerY, $rootScope.settings.xpControl.radius, 0, service.circle, false);
            service.context.fillStyle = $rootScope.settings.xpControl.fillColor;
            service.context.fill();

            //Full line color
            service.context.lineWidth = $rootScope.settings.xpControl.lineWidth;
            service.context.strokeStyle = $rootScope.settings.xpControl.fullLineColor;
            service.context.stroke();
            service.context.closePath();

            //-------------------------------------------------------------------------------------
            //Draw the arc representing the xp in the current level
            //-------------------------------------------------------------------------------------
            service.context.beginPath();

            // line color

            service.context.arc(centerX, centerY, $rootScope.settings.xpControl.radius, -(service.quarter), (($rootScope.session.xpProgress.current / $rootScope.session.xpProgress.max) * service.circle) - service.quarter, false);
            service.context.strokeStyle = $rootScope.settings.xpControl.progressLineColor;
            service.context.stroke();

            //Rank Text
            var font = "";
            if ($rootScope.settings.xpControl.font.bold === true) {
                font += "bold ";
            }

            var fontSize;
            if ($rootScope.session.rank < 10) {
                //1 digit font
                fontSize = $rootScope.settings.xpControl.font.d1;
            }
            else if ($rootScope.session.rank < 100) {
                //2 digits font
                fontSize = $rootScope.settings.xpControl.font.d2;
            }
            else {
                fontSize = $rootScope.settings.xpControl.font.d3;
            }
            font += fontSize + " ";

            font += $rootScope.settings.xpControl.font.name;

            service.context.font = font;

            // Move it down by half the text height and left by half the text width
            var rankText = "" + $rootScope.session.rank;
            var textWidth = service.context.measureText(rankText).width;
            var textHeight = service.context.measureText("w").width;

            service.context.fillStyle = $rootScope.settings.xpControl.textColor;
            service.context.fillText(rankText, centerX - (textWidth / 2), centerY + (textHeight / 2));

            service.context.closePath();

        };

        service.addXp = function (xpProgress, callbackOnRankChange) {

            var startPoint = $rootScope.session.xpProgress.current / $rootScope.session.xpProgress.max;

            if (requestAnimationFrame) {

                //Occurs after xp has already been added to the session
                for (var i = 1; i <= xpProgress.addition; i++) {
                    requestAnimationFrame(function () {
                        var endPoint = ($rootScope.session.xpProgress.current + i) / $rootScope.session.xpProgress.max;
                        animateXpAddition(startPoint, endPoint, service.quarter, service.circle);
                    })
                }
            }

            //Add the actual xp to the client side
            $rootScope.session.xpProgress = xpProgress;

            //Zero the addition
            $rootScope.session.xpProgress.addition = 0;

            if (xpProgress.rankChanged === true) {
                $rootScope.session.rank = xpProgress.rank;
                service.initXp();
                $rootScope.$broadcast("whoSmarter-rankChanged", {
                    "xpProgress": xpProgress,
                    "callback": callbackOnRankChange
                });
            }
        };

        function animateXpAddition(startPoint, endPoint) {

            service.context.beginPath();
            service.context.arc(centerX, centerY, $rootScope.settings.xpControl.radius, (service.circle * startPoint) - service.quarter, (service.circle * endPoint) - service.quarter, false);
            service.context.stroke();
            service.context.closePath();
        }

        return service;
    })

    //Payment Service
    .factory('PaymentService', function ($rootScope, ApiService, $translate, ezfb) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = 'payments/';

        service.buy = function (feature, isMobile, callbackOnSuccess, callbackOnError, config) {

            var method;

            switch ($rootScope.platform) {
                case "web" :
                    var postData = {"feature": feature.name, "language": $rootScope.session.settings.language};
                    method = "paypal";
                    return ApiService.post(path, method + "/buy", postData, function(data) {
                        if (callbackOnSuccess) {
                            callbackOnSuccess({"method" : method, "data" : data})
                        }

                    }, callbackOnError, config);
                    break;

                case "android" :
                    method = "android";
                    alert("TBD - purchase in android");
                    break;

                case "ios" :
                    method = "ios";
                    alert("TBD - purchase in ios");
                    break;

                case "facebook" :
                    method = "facebook";
                    var productUrl = ApiService.endPoint + "fb/payments/" + feature.purchaseData.productId + "/" + $rootScope.session.settings.language;
                    var facebookDialogData = {
                        "method": "pay",
                        "action": "purchaseitem",
                        "product": productUrl,
                        "request_id" : feature.name + "|" + $rootScope.session.thirdParty.id + "|" + (new Date()).getTime()
                    };
                    if (isMobile === true && $rootScope.session.features[feature.name].purchaseData.mobilePricepointId) {
                        facebookDialogData.pricepoint_id = $rootScope.session.features[feature.name].purchaseData.mobilePricepointId;
                    }

                    ezfb.ui(facebookDialogData,
                        function(data) {
                            if (callbackOnSuccess) {
                                callbackOnSuccess({"method" : method, "data" : data})
                            }
                        }
                    );
                    break;
            }
        }

        service.validate = function (transactionData, callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "validate", transactionData, callbackOnSuccess, callbackOnError, config);
        }

        return service;

    });