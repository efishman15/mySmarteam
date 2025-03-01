angular.module("topTeamer.services", [])

    //User Service
    .factory("UserService", function ($q, $rootScope, $http, $state, ApiService, MyAuthService, authService, PopupService, $translate, InfoService, FacebookService, $ionicHistory, $ionicLoading, $ionicConfig, $ionicPlatform, StoreService, $timeout) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = "user/";
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

            language = null; //StoreService.getLanguage();

            if (language) {
                service.localInitUser(callbackOnSuccess, language, geoInfo);
            }
            else {
                InfoService.getGeoInfo(function (geoResult, geoInfo) {
                StoreService.setLanguage(geoResult.language);
                service.localInitUser(callbackOnSuccess, geoResult.language, geoInfo);
                //StoreService.setLanguage("he");
                //service.localInitUser(callbackOnSuccess, "he", geoInfo);
                //});
            })}
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
                    if (!$rootScope.user || !$rootScope.user.thirdParty) {
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
                        $ionicConfig.backButton.icon("ion-chevron-left");
                    }
                    else {
                        $ionicConfig.backButton.icon("ion-chevron-right");
                    }

                    FlurryAgent.setUserId(session.userId);

                    if (session.justRegistered) {
                        FlurryAgent.logEvent("server/register");
                    }
                    else {
                        FlurryAgent.logEvent("server/login");
                    }

                    if ($rootScope.user.clientInfo.platform === "android") {

                        var push = PushNotification.init(
                            {
                                "android": $rootScope.settings.google.gcm,
                                "ios": {"alert": "true", "badge": "true", "sound": "true"},
                                "windows": {}
                            }
                        );

                        push.on("registration", function (data) {

                            if (!data || !data.registrationId) {
                                return;
                            }

                            StoreService.setGcmRegistration(data.registrationId);

                            //Update the server with the registration id - if server has no registration or it has a different reg id
                            //Just submit and forget
                            if (!session.gcmRegistrationId || session.gcmRegistrationId !== data.registrationId) {
                                ApiService.post(path, "setGcmRegistration", {"registrationId": data.registrationId}, null, null, {"blockUserInterface": false});
                            }
                        });

                        push.on("notification", function (data) {
                            if (data.additionalData && data.additionalData.contestId) {
                                $rootScope.gotoView("app.contest", false, {id: data.additionalData.contestId});
                            }
                        });

                        push.on("error", function (e) {
                            FlurryAgent.myLogError("PushNotificationError", "Error during push: " + e.message);
                        });

                        var storedGcmRegistration = StoreService.getGcmRegistration();
                        if (storedGcmRegistration && !session.gcmRegistrationId) {
                            ApiService.post(path, "setGcmRegistration", {"registrationId": storedGcmRegistration}, null, null, {"blockUserInterface": false});
                        }
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

                            if ($state.current.data && $state.current.data.backButtonHandler) {
                                $state.current.data.backButtonHandler(event, PopupService, $state.current, $rootScope);
                            }
                            else {
                                $rootScope.goBack();
                            }
                        }, 600);

                        //------------------------------------------------------------------------------------
                        //-- Load languages from server - can be done without waiting for result
                        //------------------------------------------------------------------------------------

                        //Define core events and functions to be used in the app
                        $rootScope.$on("topTeamer-httpRequest", function (event, config) {
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
                                        animation: "fade-in",
                                        showBackdrop: true,
                                        showDelay: 50
                                    }
                                )
                            }
                        });

                        $rootScope.$on("topTeamer-httpResponse", function (event, response) {
                            if (!response.config || response.config.blockUserInterface) {
                                $ionicLoading.hide();
                            }
                            if (response.data.serverPopup) {
                                var popupEvent = {
                                    "name": "topTeamer-serverPopup",
                                    "data": response.data.serverPopup
                                };
                                resolveEvents.push(popupEvent);
                            }
                        });

                        $rootScope.$on("topTeamer-httpResponseError", function (event, rejection) {
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

                        $rootScope.$on("$translateChangeEnd", function (event, data) {
                            $rootScope.$broadcast("topTeamer-languageChanged");
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

                        $rootScope.$on("topTeamer-serverPopup", function (event, data) {
                            //Show the popup with a delay since it might be shown right on app init/login
                            $timeout(function () {
                                $rootScope.gotoView("serverPopup", false, {serverPopup: data})
                            }, 1000);
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
                );
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
    .factory("InfoService", function ($http, ApiService, $rootScope, $timeout) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = "info/";

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
    .factory("ContestsService", function ($http, ApiService, $rootScope, $translate) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = "contests/";

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
        service.getContests = function (tab, callbackOnSuccess, callbackOnError, config) {
            var postData = {"tab": tab};
            return ApiService.post(path, "list", postData, callbackOnSuccess, callbackOnError, config)
        };

        //timeMode = "starts" or "ends"
        service.prepareContestChart = function (contest, timeMode) {

            var contestCaption;
            var contestSubCaption;
            var contestSubCaptionColor;

            var contestChart = JSON.parse(JSON.stringify($rootScope.settings.charts.contest));
            contestChart.contest = contest;

            contestChart.data = [];
            var teamsOrder;
            if ($rootScope.settings.languages[$rootScope.user.settings.language].direction == "ltr") {
                teamsOrder = [0, 1];
            }
            else {
                teamsOrder = [1, 0];
            }

            var timePhrase = service.getTimePhrase(contest, timeMode);

            if (timeMode === "ends" && contest.status === "finished") {
                //Contest Finished
                contestCaption = $translate.instant("WHO_IS_SMARTER_QUESTION_CONTEST_FINISHED");

                if (contest.teams[0].chartValue > contest.teams[1].chartValue) {
                    contestSubCaption = contest.teams[0].name;
                    contestChart.chart.paletteColors = $rootScope.settings.charts.finishedPalette[teamsOrder[0]];
                }
                else if (contest.teams[0].chartValue < contest.teams[1].chartValue) {
                    contestSubCaption = contest.teams[1].name;
                    contestChart.chart.paletteColors = $rootScope.settings.charts.finishedPalette[teamsOrder[1]];
                }
                else {
                    contestSubCaption = $translate.instant("TIE");
                    contestChart.chart.paletteColors = $rootScope.settings.charts.finishedPalette[2];
                }

                contestSubCaptionColor = $rootScope.settings.charts.subCaption.finished.color;
            }
            else {
                contestCaption = $translate.instant("WHO_IS_SMARTER")
                contestSubCaption = $translate.instant("CONTEST_NAME", {
                    team0: contest.teams[0].name,
                    team1: contest.teams[1].name
                });
                contestSubCaptionColor = $rootScope.settings.charts.subCaption.running.color;
            }

            var contestTimeWidth = canvasContext.measureText(timePhrase.text).width;
            var contestParticipantsString = $translate.instant("CONTEST_PARTICIPANTS", {participants: contest.participants + contest.manualParticipants});
            var contestParticipantsWidth = canvasContext.measureText(contestParticipantsString).width;

            var direction = $rootScope.settings.languages[$rootScope.user.settings.language].direction;
            var magicNumbers = $rootScope.settings.charts.contestAnnotations.annotationHorizontalMagicNumbers[direction];

            contestChart.annotations.groups[0].items[magicNumbers.time.id].text = timePhrase.text;
            contestChart.annotations.groups[0].items[magicNumbers.time.id].x = magicNumbers.time.position + (contestTimeWidth / 2 + magicNumbers.time.spacing);
            contestChart.annotations.groups[0].items[magicNumbers.time.id].fontColor = timePhrase.color;

            contestChart.annotations.groups[0].items[magicNumbers.participants.id].text = contestParticipantsString;
            contestChart.annotations.groups[0].items[magicNumbers.participants.id].x = magicNumbers.participants.position + (contestParticipantsWidth / 2 + magicNumbers.participants.spacing);

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
            contestChart.chart.subCaption = contestSubCaption;
            contestChart.chart.subCaptionFontColor = contestSubCaptionColor;

            return contestChart;
        };

        //Join Contest
        service.joinContest = function (contestId, teamId, callbackOnSuccess, callbackOnError, config) {
            var postData = {"contestId": contestId, "teamId": teamId};
            return ApiService.post(path, "join", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Retrieve Contest User Questions
        service.getQuestions = function (userQuestions, callbackOnSuccess, callbackOnError, config) {
            var postData = {"userQuestions": userQuestions};
            return ApiService.post(path, "getQuestions", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Retrieve Contest User Questions
        service.searchMyQuestions = function (text, existingQuestionIds, callbackOnSuccess, callbackOnError, config) {
            var postData = {"text": text, "existingQuestionIds": existingQuestionIds};
            return ApiService.post(path, "searchMyQuestions", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Retruns an object {"time" : "ends in xxx, started in xxx, ended xxx days ago, starting etc...", "color" : #color
        service.getTimePhrase = function (contest, timeMode) {

            var now = (new Date()).getTime();

            //Set contest status
            if (contest.endDate < now) {
                contest.status = "finished";
            }
            else if (contest.startDate > now) {
                contest.status = "starting";
            }
            else {
                contest.status = "running";
            }

            var contestTimeTerm;
            var contestTimeNumber;
            var contestTimeUnits;
            var contestTimeColor;

            if (timeMode === "starts") {
                var startMinutes = Math.abs(now - contest.startDate) / 1000 / 60;
                if (startMinutes >= 60 * 24) {
                    contestTimeNumber = Math.ceil(startMinutes / 24 / 60);
                    contestTimeUnits = "DAYS";
                }
                else if (startMinutes >= 60) {
                    contestTimeNumber = Math.ceil(startMinutes / 60);
                    contestTimeUnits = "HOURS";
                }
                else {
                    contestTimeNumber = Math.ceil(startMinutes);
                    contestTimeUnits = "MINUTES";
                }

                contestTimeColor = $rootScope.settings.charts.contestAnnotations.time.running.color;

                if (contest.status === "running") {
                    contestTimeTerm = "CONTEST_STARTED";
                }
                else {
                    contestTimeTerm = "CONTEST_STARTING";
                }
            }
            else if (timeMode === "ends") {
                var endMinutes = Math.abs(contest.endDate - now) / 1000 / 60;
                if (endMinutes >= 60 * 24) {
                    contestTimeNumber = Math.ceil(endMinutes / 24 / 60);
                    contestTimeUnits = "DAYS";
                }
                else if (endMinutes >= 60) {
                    contestTimeNumber = Math.ceil(endMinutes / 60);
                    contestTimeUnits = "HOURS";
                }
                else {
                    contestTimeNumber = Math.ceil(endMinutes);
                    contestTimeUnits = "MINUTES";
                }

                if (contest.status === "running") {
                    contestTimeTerm = "CONTEST_ENDS_IN";
                    contestTimeColor = $rootScope.settings.charts.contestAnnotations.time.running.color;
                }
                else {
                    //Contest Finished
                    contestTimeTerm = "CONTEST_ENDED";
                    contestTimeColor = $rootScope.settings.charts.contestAnnotations.time.finished.color;
                }
            }

            var contestTimeString = $translate.instant(contestTimeTerm, {
                number: contestTimeNumber,
                units: $translate.instant(contestTimeUnits)
            });

            return {"text": contestTimeString, "color": contestTimeColor};
        }

        return service;
    })

    //Quiz Service.
    .factory("QuizService", function ($http, ApiService) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = "quiz/";

        //Start quiz
        service.start = function (contestId, callbackOnSuccess, callbackOnError, config) {
            var postData = {"contestId": contestId};
            return ApiService.post(path, "start", postData, callbackOnSuccess, callbackOnError, config)
        };

        //Answer a quiz question
        service.answer = function (answerId, hintUsed, answerUsed, callbackOnSuccess, callbackOnError, config) {
            var postData = {"id": answerId};
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

        //Set Question By Admin
        service.setQuestionByAdmin = function (question, callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "setQuestionByAdmin", {"question": question}, callbackOnSuccess, callbackOnError, config)
        };

        return service;
    })

    //Error Service
    .factory("PopupService", function ($ionicPopup, $translate, $rootScope) {

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
                type: "button-positive",
                onTap: function (e) {
                    // Returning a value will cause the promise to resolve with the given value.
                    return "OK";
                }
            };
            var cancelButton = {
                text: $translate.instant("CANCEL"),
                type: "button-default",
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

        service.confirmExitApp = function () {
            service.confirm("EXIT_APP_TITLE", "EXIT_APP_MESSAGE", null, function () {
                FlurryAgent.endSession();
                ionic.Platform.exitApp();
            });
        };

        return service;
    })

    //MyAuthService Service
    .factory("MyAuthService", function () {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        //Confirm login
        service.confirmLogin = function (token, config) {
            config.headers["Authorization"] = token;
            return config;
        };

        return service;
    })

    //Api Service
    .factory("ApiService", function ($http, $location) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        if (!window.cordova) {
            service.endPoint = $location.$$protocol + "://" + $location.$$host + "/";
        }
        else {
            service.endPoint = "http://www.topteamer.com/"
        }

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
    .factory("FacebookService", function (ezfb, $timeout) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        //Login
        service.login = function (callbackOnSuccess, callbackOnError, permissions, rerequestDeclinedPermissions) {
            if (window.cordova) {
                facebookConnectPlugin.login(permissions, callbackOnSuccess, callbackOnError);
            }
            else {
                try {
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
                catch (error) {
                    if (!callbackOnError) {
                        FlurryAgent.myLogError("ezfbError", "Error during login: " + error.message);
                    } else {
                        callbackOnError(error.message);
                    }

                }
            }
        };

        //Get Login Status
        service.getLoginStatus = function (callbackOnSuccess, callbackOnError) {
            if (window.cordova) {
                facebookConnectPlugin.getLoginStatus(function (response) {
                    if (response && response.status === "unknown") {
                        //Give it another try as facebook native is not yet initiated
                        $timeout(function () {
                            facebookConnectPlugin.getLoginStatus(callbackOnSuccess, callbackOnError);
                        }, 500);
                    }
                    else {
                        if (callbackOnSuccess) {
                            callbackOnSuccess(response);
                        }
                    }
                }, callbackOnError);
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
                facebookConnectPlugin.logout(callbackOnSuccess, callbackOnError);
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

        service.post = function (story, callbackOnSuccess, callbackOnError) {

            if (window.cordova) {
                var mobilePostObject = {
                    "method": "share_open_graph",
                    "action": story.action,
                    "previewPropertyName": story.object.name,
                    "previewPropertyValue": story.object.value
                };

                facebookConnectPlugin.showDialog(mobilePostObject, function (response) {
                    callbackOnSuccess(response);
                }, callbackOnError)
            }
            else {
                var webPostObject = {
                    "method": "share_open_graph",
                    "action_type": story.action,
                    "action_properties": {}
                };
                webPostObject.action_properties[story.object.name] = story.object.value;

                try {
                    ezfb.ui(webPostObject, function (response) {
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

        return service;
    })

    //Sound Service
    .factory("SoundService", function ($rootScope) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var audio = new Audio();
        var playOgg = !!(audio.canPlayType && audio.canPlayType("audio/ogg; codecs='vorbis'").replace(/no/, ""));
        var playMp3 = !!(audio.canPlayType && audio.canPlayType("audio/mpeg").replace(/no/, ""));

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
    .factory("XpService", function ($rootScope, $window) {

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
            var addition = xpProgress.addition;
            for (var i = 1; i <= addition; i++) {
                myRequestAnimationFrame(function () {
                    var endPoint = ($rootScope.session.xpProgress.current + i) / $rootScope.session.xpProgress.max;
                    animateXpAddition(startPoint, endPoint, service.quarter, service.circle);

                    //Last iteration should be performed after the animation frame event happened
                    if (i >= addition) {

                        //Add the actual xp to the client side
                        $rootScope.session.xpProgress = xpProgress;

                        //Zero the addition
                        $rootScope.session.xpProgress.addition = 0;

                        if (xpProgress.rankChanged) {
                            $rootScope.session.rank = xpProgress.rank;
                            service.initXp();
                            $rootScope.$broadcast("topTeamer-rankChanged", {
                                "xpProgress": xpProgress,
                                "callback": callbackOnRankChange
                            });
                        }
                    }
                })
            }

        };

        function animateXpAddition(startPoint, endPoint) {

            service.context.beginPath();
            service.context.arc(centerX, centerY, $rootScope.settings.xpControl.radius, (service.circle * startPoint) - service.quarter, (service.circle * endPoint) - service.quarter, false);
            service.context.strokeStyle = $rootScope.settings.xpControl.progressLineColor;
            service.context.stroke();
            service.context.closePath();
        }

        return service;
    })

    //Store Service
    .factory("StoreService", function (ApiService, store) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        service.getLanguage = function () {
            return store.get("topTeamer-language");
        }

        service.setLanguage = function (language) {
            store.set("topTeamer-language", language);
        }

        service.getGcmRegistration = function () {
            return store.get("topTeamer-gcmRegistration");
        }

        service.setGcmRegistration = function (gcmRegistration) {
            store.set("topTeamer-gcmRegistration", gcmRegistration);
        }

        return service;

    })

    //Payment Service
    .factory("PaymentService", function ($rootScope, ApiService, $translate, ezfb) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = "payments/";

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
            var postData = {"method": method, "purchaseData": purchaseData};
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
    .factory("ScreenService", function ($rootScope) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        service.resizeCanvas = function () {

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
    .factory("LeaderboardService", function (ApiService) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = "leaderboard/";

        service.getContestLeaders = function (contestId, teamId, callbackOnSuccess, callbackOnError, config) {

            var postData = {"contestId": contestId};
            if (teamId === 0 || teamId === 1) {
                postData.teamId = teamId;
            }
            return ApiService.post(path, "contest", postData, callbackOnSuccess, callbackOnError, config)
        };

        service.getFriends = function (friendsPermissionJustGranted, callbackOnSuccess, callbackOnError, config) {
            var postData = {};
            if (friendsPermissionJustGranted) {
                postData.friendsPermissionJustGranted = friendsPermissionJustGranted;
            }
            return ApiService.post(path, "friends", postData, callbackOnSuccess, callbackOnError, config)
        };

        service.getWeeklyLeaders = function (callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "weekly", null, callbackOnSuccess, callbackOnError, config)
        };

        return service;

    })

    //Leaderboard Service
    .factory("ShareService", function ($translate, $rootScope, $cordovaSocialSharing) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var emailRef = "?ref=shareEmail";

        function adjustUrl(url) {
            if (!$rootScope.user.clientInfo.mobile) {
                return encodeURIComponent(url);
            }
            else {
                return url;
            }
        }

        service.getVariables = function (contest) {

            var shareVariables = {};

            if (contest) {
                shareVariables.shareUrl = contest.link;
                shareVariables.shareSubject = $translate.instant("SHARE_SUBJECT_WITH_CONTEST", {name: contest.name});

                if (contest.myTeam === 0 || contest.myTeam === 1) {
                    shareVariables.shareBody = $translate.instant("SHARE_BODY_WITH_CONTEST", {
                        team: contest.teams[contest.myTeam].name,
                        url: shareVariables.shareUrl
                    });
                    shareVariables.shareBodyEmail = $translate.instant("SHARE_BODY_WITH_CONTEST", {
                        team: contest.teams[contest.myTeam].name,
                        url: shareVariables.shareUrl + emailRef
                    });
                    shareVariables.shareBodyNoUrl = $translate.instant("SHARE_BODY_NO_URL_WITH_CONTEST", {
                        team: contest.teams[contest.myTeam].name,
                        name: contest.name
                    });
                }
                else {
                    shareVariables.shareBody = $translate.instant("SHARE_BODY", {url: shareVariables.shareUrl});
                    shareVariables.shareBodyEmail = $translate.instant("SHARE_BODY", {url: shareVariables.shareUrl + emailRef});
                    shareVariables.shareBodyNoUrl = $translate.instant("SHARE_BODY_NO_URL");
                }
            }
            else {
                shareVariables.shareUrl = adjustUrl($rootScope.settings.general.downloadUrl[$rootScope.user.settings.language]);
                shareVariables.shareSubject = $translate.instant("SHARE_SUBJECT");
                shareVariables.shareBody = $translate.instant("SHARE_BODY", {url: shareVariables.shareUrl});
                shareVariables.shareBodyEmail = $translate.instant("SHARE_BODY", {url: shareVariables.shareUrl + emailRef});
                shareVariables.shareBodyNoUrl = $translate.instant("SHARE_BODY_NO_URL") + " - '" + $translate.instant("WHO_IS_SMARTER_QUESTION") + "'";
            }

            return shareVariables;

        };

        service.mobileShare = function (contest) {

            var shareVariables = service.getVariables(contest);

            $cordovaSocialSharing.share(shareVariables.shareBodyNoUrl,
                shareVariables.shareSubject,
                $rootScope.settings.general.baseUrl + $rootScope.settings.general.logoUrl,
                shareVariables.shareUrl
            );
        };

        return service;

    })

    //System tools Service.
    .factory("SystemToolsService", function ($http, ApiService) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = "system/";

        //Clear Cache
        service.clearCache = function (callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "clearCache", null, callbackOnSuccess, callbackOnError, config)
        };

        //Restart Server
        service.restartServer = function (callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "restart", null, callbackOnSuccess, callbackOnError, config)
        };

        return service;
    })

    //Hosted Games Service.
    .factory("HostedGamesService", function ($http, ApiService) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;
        var path = "hostedGames/";

        //Get Categories
        service.getCategories = function (callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "categories", null, callbackOnSuccess, callbackOnError, config)
        };

        //Get Games
        service.getGames = function (categoryId, callbackOnSuccess, callbackOnError, config) {
            return ApiService.post(path, "games", {"categoryId": categoryId}, callbackOnSuccess, callbackOnError, config)
        };

        return service;
    })

    //Date Service.
    .factory("DateService", function ($translate) {

        //----------------------------------------------
        // Service Variables
        //----------------------------------------------
        var service = this;

        var months = $translate.instant("MONTHS").split(",");

        //Format client date
        service.formatContestCreateDate = function (dateEpoch) {

            var date = new Date(dateEpoch);
            var day = date.getDate();
            var monthIndex = date.getMonth();
            var year = date.getFullYear();

            return $translate.instant("CONTEST_CREATED_ON", {day: day, month: months[monthIndex], year: year});
        };

        return service;
    })


