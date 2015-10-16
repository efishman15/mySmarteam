angular.module('whoSmarter.services', [])

    //User Service
    .factory('UserService', function ($q, $rootScope, $http, $state, ApiService, MyAuthService, authService, PopupService, $translate, InfoService, FacebookService, $ionicHistory, $ionicLoading, $ionicConfig, $ionicPlatform, StoreService) {

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

            language = StoreService.getLanguage();

            if (language) {
                service.localInitUser(callbackOnSuccess, language, geoInfo);
            }
            else {
                //InfoService.getGeoInfo(function (geoResult, geoInfo) {
                    //StoreService.setLanguage(geoResult.language);
                    //service.localInitUser(callbackOnSuccess, geoResult.language, geoInfo);
                    StoreService.setLanguage("he");
                    service.localInitUser(callbackOnSuccess, "he", geoInfo);
                //});
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
                        $rootScope.user.settings.language = session.settings.language;
                        StoreService.setLanguage(session.settings.language);
                    }
                    $rootScope.user.settings = session.settings;

                    $rootScope.session = session;

                    if ($rootScope.settings.languages[$rootScope.session.settings.language].direction == "ltr") {
                        $ionicConfig.backButton.icon('ion-chevron-left');
                    }
                    else {
                        $ionicConfig.backButton.icon('ion-chevron-right');
                    }

                    FlurryAgent.setUserId(session.userId);

                    if (session.justRegistered) {
                        FlurryAgent.logEvent("server/register");
                    }
                    else {
                        FlurryAgent.logEvent("server/login");
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
            }, callbackOnError, $rootScope.settings.facebook.readPermissions);

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

                        $rootScope.user.clientInfo = {};

                        if (window.cordova) {
                            if (!$rootScope.user.clientInfo.appVersion) {
                                $rootScope.user.clientInfo.appVersion = $rootScope.appVersion;
                            }
                            $rootScope.user.clientInfo.platformVersion = ionic.Platform.version();

                            $rootScope.user.clientInfo.mobile = true;

                            if (ionic.Platform.isAndroid()) {
                                $rootScope.user.clientInfo.platform = "android";
                            }
                            else if (ionic.Platform.isIOS()) {
                                $rootScope.user.clientInfo.platform = "ios";
                            }
                        }
                        else {
                            if (window.self !== window.top) {
                                //running inside an iframe, e.g. facebook canvas
                                $rootScope.user.clientInfo.platform = "facebook";
                            }
                            else {
                                $rootScope.user.clientInfo.platform = "web";
                            }
                            $rootScope.user.clientInfo.mobile = false;
                        }

                        $ionicPlatform.registerBackButtonAction(function (event) {

                            if ($rootScope.user.clientInfo.platform === "android" &&
                                (
                                ($state.current.name.length >= 8 && $state.current.name.substring(0, 8) === "app.tabs" ) ||
                                ($state.current.name === "home"))) {
                                PopupService.confirm("EXIT_APP_TITLE", "EXIT_APP_MESSAGE", null, function () {
                                    FlurryAgent.endSession();
                                    ionic.Platform.exitApp();
                                });
                            }
                            else if ($state.current.name === "serverPopup" || ($state.current.name === "app.quiz" && $rootScope.preventBack)) {
                                event.preventDefault();
                            }
                            else {
                                if (navigator && navigator.app && navigator.app.backHistory) {
                                    navigator.app.backHistory();
                                }
                            }
                        }, 600);

                        //------------------------------------------------------------------------------------
                        //-- Load languages from server - can be done without waiting for result
                        //------------------------------------------------------------------------------------

                        //Define core events and functions to be used in the app
                        $rootScope.$on("whoSmarter-httpRequest", function (event, config) {
                            if (!config || config.blockUserInterface) {
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

                        $rootScope.$on("whoSmarter-httpResponse", function (event, response) {
                            if (!response.config || response.config.blockUserInterface) {
                                $ionicLoading.hide();
                            }
                            if (response.data.serverPopup) {
                                var popupEvent = {
                                    "name": "whoSmarter-serverPopup",
                                    "data": response.data.serverPopup
                                };
                                if (resolveRequests.length > 0) {
                                    resolveEvents.push(popupEvent);
                                }
                                else {
                                    $rootScope.$broadcast(popupEvent.name, popupEvent.data);
                                }
                            }
                        });

                        $rootScope.$on("whoSmarter-httpResponseError", function (event, rejection) {
                            if (!rejection.config || rejection.config.blockUserInterface) {
                                $ionicLoading.hide();
                            }
                            if (rejection.data instanceof Object && rejection.data.type && rejection.status != 401) {
                                if (rejection.config && rejection.config.onServerErrors && rejection.data.type && rejection.config.onServerErrors[rejection.data.type]) {
                                    //Caller has set a function to be invoked after user presses ok on the alert
                                    if (!rejection.config.onServerErrors[rejection.data.type].confirm) {
                                        rejection.data.onTap = rejection.config.onServerErrors[rejection.data.type].next;
                                        PopupService.alert(rejection.data);
                                    }
                                    else {
                                        var title = $translate.instant(rejection.data.type + "_TITLE");
                                        var message = $translate.instant(rejection.data.type + "_MESSAGE");
                                        PopupService.confirm(title, message, rejection.config.onServerErrors[rejection.data.type].params, rejection.config.onServerErrors[rejection.data.type].next);
                                    }
                                }
                                else {
                                    PopupService.alert(rejection.data)
                                }
                            }
                        });

                        $rootScope.$on("event:auth-loginRequired", function (event, rejection) {
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

                        $rootScope.$on('$translateChangeEnd', function (event, data) {
                            $rootScope.$broadcast("whoSmarter-languageChanged");
                        });

                        $rootScope.gotoView = function (viewName, isRootView, params, clearHistory, disableAnimate) {

                            if (isRootView == null) {
                                isRootView = true;
                            }

                            if (!params) {
                                params = {};
                            }

                            var disableBack = false;
                            disableAnimate = false || disableAnimate;

                            if (isRootView) {

                                disableBack = true;

                                if (clearHistory == null) {
                                    clearHistory = true;
                                }

                                if (clearHistory) {
                                    $ionicHistory.clearHistory();
                                }
                            }
                            else {
                                clearHistory = false;
                            }

                            $ionicHistory.nextViewOptions({
                                disableBack: disableBack,
                                historyRoot: clearHistory,
                                disableAnimate: disableAnimate
                            });



                            $state.go(viewName, params, {reload: true, inherit: true, location: true});

                        };

                        $rootScope.gotoRootView = function () {
                            if ($rootScope.session || ($rootScope.user && $rootScope.user.thirdParty)) {
                                $rootScope.gotoView("app.tabs.myContests");
                            }
                            else {
                                $rootScope.gotoView("home");
                            }
                        };

                        $rootScope.goBack = function () {
                            if ($ionicHistory.backView()) {
                                $ionicHistory.goBack();
                            }
                            else {
                                $rootScope.gotoRootView();
                            }
                        }

                        $rootScope.$on("whoSmarter-serverPopup", function (event, data) {
                            $rootScope.gotoView("serverPopup", false, {serverPopup: data})
                        });

                        if (!$rootScope.settings) {
                            InfoService.getSettings(
                                function (data) {
                                    $rootScope.settings = data;

                                    if (!resolveData) {
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
        service.saveSettingsToServer = function (settings, callbackOnSuccess, callbackOnError, config) {
            var postData = {"settings": settings};
            ApiService.post(path, "settings", postData, callbackOnSuccess, callbackOnError, config);
        }

        //Toggle sound to server
        service.toggleSound = function (callbackOnSuccess, callbackOnError, config) {
            ApiService.post(path, "toggleSound", null, callbackOnSuccess, callbackOnError, config);
        }

        return service;
    })

    //Info service
    .factory('InfoService', function ($http, ApiService, $rootScope, $timeout) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = 'info/';

        var geoProviders = ["http://www.telize.com/geoip", "http://freegeoip.net/json"];

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
            var config = {"timeout": 5000}
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
                        function (status, data) {
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

            //Wait until appVersion is set (in app.js)
            if (window.cordova && !$rootScope.user.clientInfo.appVersion) {
                $timeout(function () {
                    service.getSettings(callbackOnSuccess, callbackOnError, config)
                }, 100);
                return;
            }

            var postData = {};

            postData.language = $rootScope.user.settings.language;
            postData.clientInfo = $rootScope.user.clientInfo;

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

        //Get Contest
        service.getContest = function (contestId, callbackOnSuccess, callbackOnError, config) {
            var postData = {"contestId": contestId};
            return ApiService.post(path, "get", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Set Contest
        service.setContest = function (contest, mode, callbackOnSuccess, callbackOnError, config) {
            var postData = {"contest": contest, "mode": mode};
            return ApiService.post(path, "set", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Remove Contest
        service.removeContest = function (contestId, callbackOnSuccess, callbackOnError, config) {
            var postData = {"contestId": contestId};
            return ApiService.post(path, "remove", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Get Contests
        service.getContests = function (clientContestCount, tab, callbackOnSuccess, callbackOnError, config) {
            var postData = {"clientContestCount": clientContestCount, "tab": tab};
            return ApiService.post(path, "list", postData, callbackOnSuccess, callbackOnError, config)
        };

        service.prepareContestChart = function (contest) {
            var contestCaption = $translate.instant("WHO_IS_SMARTER");
            var contestChart = JSON.parse(JSON.stringify($rootScope.settings.charts.contest));
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

            if (contest.myTeam === 0 || contest.myTeam === 1) {
                contestChart.data[teamsOrder[contest.myTeam]].labelFontBold = true;
            }

            contestChart.chart.caption = contestCaption;
            contestChart.chart.subCaption = $translate.instant("CONTEST_NAME", {
                team0: contest.teams[0].name,
                team1: contest.teams[1].name
            });

            return contestChart;
        };

        //Join Contest
        service.joinContest = function (contestId, teamId, callbackOnSuccess, callbackOnError, config) {
            var postData = {"contestId": contestId, "teamId": teamId};
            return ApiService.post(path, "join", postData, callbackOnSuccess, callbackOnError, config)
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
        service.start = function (contestId, callbackOnSuccess, callbackOnError, config) {
            var postData = {"contestId" : contestId};
            return ApiService.post(path, "start", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Answer a quiz question
        service.answer = function (answerId, hintUsed, answerUsed, callbackOnSuccess, callbackOnError, config) {
            var postData = {"id" : answerId};
            if (hintUsed) {
                postData.hintUsed = true;
            }
            if (answerUsed) {
                postData.answerUsed = true;
            }
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
                cssClass: $rootScope.settings.languages[$rootScope.user.settings.language].direction,
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
        service.login = function (callbackOnSuccess, callbackOnError, permissions, rerequestDeclinedPermissions) {
            if (window.cordova) {
                window.cordova.exec(callbackOnSuccess, callbackOnError, "FacebookConnectPlugin", "login", permissions);
            }
            else {
                var permissionObject = {};
                if (permissions && permissions.length > 0) {
                    permissionObject.scope = permissions.toString();
                    if (rerequestDeclinedPermissions) {
                        permissionObject.auth_type = "rerequest";
                    }
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
                        FlurryAgent.myLogError("ezfbError", "Error getting login status: " + error.message);
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
            if (!$rootScope.session.settings.sound) {
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

    //XpService Service
    .factory('XpService', function ($rootScope, $window) {

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
            if ($rootScope.settings.xpControl.font.bold) {
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

            //Occurs after xp has already been added to the session
            for (var i = 1; i <= xpProgress.addition; i++) {
                myRequestAnimationFrame(function () {
                    var endPoint = ($rootScope.session.xpProgress.current + i) / $rootScope.session.xpProgress.max;
                    animateXpAddition(startPoint, endPoint, service.quarter, service.circle);
                })
            }

            //Add the actual xp to the client side
            $rootScope.session.xpProgress = xpProgress;

            //Zero the addition
            $rootScope.session.xpProgress.addition = 0;

            if (xpProgress.rankChanged) {
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

    //Store Service
    .factory('StoreService', function (ApiService, store) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        service.getLanguage = function () {
            return store.get("whoSmarter-language");
        }

        service.setLanguage = function (language) {
            store.set("whoSmarter-language", language);
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

            switch ($rootScope.user.clientInfo.platform) {
                case "web" :
                    var postData = {"feature": feature.name, "language": $rootScope.session.settings.language};
                    method = "paypal";
                    return ApiService.post(path, method + "/buy", postData, function (data) {
                        if (callbackOnSuccess) {
                            callbackOnSuccess({"method": method, "data": data})
                        }

                    }, callbackOnError, config);
                    break;

                case "android" :
                    method = "android";
                    inappbilling.buy(function (purchaseData) {
                            callbackOnSuccess({"method": method, "data": purchaseData});
                        },
                        function (error) {
                            //Error messages will be displayed inside google
                            callbackOnError(error);
                        },
                        feature.purchaseData.productId);
                    break;

                case "ios" :
                    method = "ios";
                    alert("TBD - purchase in ios");
                    break;

                case "facebook" :
                    method = "facebook";
                    var productUrl = ApiService.endPoint + "facebook/product/" + feature.purchaseData.productId + "/" + $rootScope.session.settings.language;
                    var facebookDialogData = {
                        "method": "pay",
                        "action": "purchaseitem",
                        "product": productUrl,
                        "request_id": feature.name + "|" + $rootScope.session.thirdParty.id + "|" + (new Date()).getTime()
                    };
                    if (isMobile && $rootScope.session.features[feature.name].purchaseData.mobilePricepointId) {
                        facebookDialogData.pricepoint_id = $rootScope.session.features[feature.name].purchaseData.mobilePricepointId;
                    }

                    ezfb.ui(facebookDialogData,
                        function (data) {
                            if (callbackOnSuccess) {
                                callbackOnSuccess({"method": method, "data": data})
                            }
                        }
                    );
                    break;
            }
        }

        service.processPayment = function (method, purchaseData, extraPurchaseData, callbackOnSuccess, callbackOnError, config) {
            var postData = {"method" : method, "purchaseData" : purchaseData};
            if (extraPurchaseData) {
                postData.extraPurchaseData = extraPurchaseData;
            }
            return ApiService.post(path, "process", postData, function (serverPurchaseData) {
                if (callbackOnSuccess) {
                    callbackOnSuccess(serverPurchaseData);
                }
            }, callbackOnError, config);
        };

        service.showPurchaseSuccess = function (serverPurchaseData) {
            $rootScope.session.features = serverPurchaseData.features
            $rootScope.gotoView("payment", false, {
                "purchaseMethod": "facebook",
                "featurePurchased": serverPurchaseData.featurePurchased,
                "nextView": serverPurchaseData.nextView
            });
        }

        return service;

    })

    //Screen Service
    .factory('ScreenService', function ($rootScope) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        service.resizeCanvas = function() {

            if ($rootScope.user.clientInfo.mobile) {
                return;
            }

            var containerWidth = window.innerWidth;

            var hostingView = document.getElementById("myHostingView");
            if (hostingView) {

                if (containerWidth > $rootScope.settings.general.webCanvasWidth) {
                    hostingView.style.width = $rootScope.settings.general.webCanvasWidth + "px";
                    hostingView.style.marginLeft = (containerWidth - $rootScope.settings.general.webCanvasWidth) / 2 + "px";
                }
            }
        };

        return service;

    })

    //Leaderboard Service
    .factory('LeaderboardService', function (ApiService) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = 'leaderboard/';

        service.getContestLeaders = function(contestId, teamId, callbackOnSuccess, callbackOnError, config) {

            var postData = {"contestId" : contestId};
            if (teamId === 0 || teamId === 1) {
                postData.teamId = teamId;
            }
            return ApiService.post(path, "contest", postData, callbackOnSuccess, callbackOnError, config)
        };

        service.getFriends = function(friendsPermissionJustGranted, callbackOnSuccess, callbackOnError, config) {
            var postData = {};
            if (friendsPermissionJustGranted) {
                postData.friendsPermissionJustGranted = friendsPermissionJustGranted;
            }
            return ApiService.post(path, "friends", postData, callbackOnSuccess, callbackOnError, config)
        };

        service.getWeeklyLeaders = function(callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "weekly", null, callbackOnSuccess, callbackOnError, config)
        };

        return service;

    })
