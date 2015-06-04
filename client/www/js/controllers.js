angular.module('eddy1.controllers', ['eddy1.services', 'ngResource'])

    .controller('AppCtrl', function ($scope, $rootScope, $state, LoginService, UserService) {

        //Perform auto-login if login details are saved in store
        $rootScope.isLoggedIn = false;
        var currentUser = UserService.getCurrentUser();
        if (currentUser && currentUser.email) {
            //Auto silent login based on the credentials in the storage
            LoginService.login(currentUser,
                function (data) {
                    $rootScope.isLoggedIn = true;
                    $rootScope.user = currentUser;
                    console.log("Logged In as: " + currentUser.email);
                },
                function (status) {
                    console.log("Failed to auto log in as: " + currentUser.email + " (" + status + ")");
                    UserService.setCurrentUser(UserService.initUser());
                }
            )
        }
    })

    .controller('RegisterCtrl', function ($scope, $rootScope, $http, $state, LoginService, UserService, authService) {
        $rootScope.user = UserService.initUser();

        $scope.register = function (registrationForm) {

            $rootScope.user.email = registrationForm.email.$modelValue;
            $rootScope.user.password = registrationForm.password.$modelValue;

            LoginService.register($rootScope.user,
                function (data) {
                    UserService.setCurrentUser($rootScope.user);
                    $rootScope.isLoggedIn = true;
                },
                function (status) {
                    if (status == 401) {
                        $scope.message = "Email already exist.";
                    }
                    else {
                        $scope.message = "Invalid email address."
                    }
                });
        };

        $scope.$on('event:auth-loginRequired', function (e, rejection) {
            $scope.user = UserService.getCurrentUser();
            if ($rootScope.user && !$rootScope.user.email) {
                $rootScope.user = UserService.initUser();
                $state.go('app.login', {}, {reload: true, inherit: true});
            }
            else {
                $scope.login();
            }
        });
    })


    .controller('LoginCtrl', function ($scope, $rootScope, $http, $state, LoginService, UserService, authService) {
        $scope.message = "";
        $rootScope.user = UserService.initUser();

        $scope.login = function () {
            LoginService.login($rootScope.user,
                function (data) {
                    UserService.setCurrentUser($rootScope.user);
                    $rootScope.isLoggedIn = true;
                    authService.loginConfirmed(); //will release queued http requests
                },
                function (status) {
                    if (status == 401) {
                        $scope.message = "Invalid Username or Password.";
                    }
                    else {
                        $scope.message = "Login failed."
                    }
                });
        };

        $scope.$on('event:auth-loginRequired', function (e, rejection) {
            $scope.user = UserService.getCurrentUser();
            if ($rootScope.user && !$rootScope.user.email) {
                $rootScope.user = UserService.initUser();
                $state.go('app.login', {}, {reload: true, inherit: true});
            }
            else {
                $scope.login();
            }
        });
    })

    .controller('HomeCtrl', function ($ionicHistory) {
        // This a temporary solution to solve an issue where the back button is displayed when it should not be.
        // This is fixed in the nightly ionic build so the next release should fix the issue
        $ionicHistory.clearHistory;
    })

    .controller('SessionsCtrl', function ($scope, $rootScope, SessionsService) {
        $scope.$on('$ionicView.beforeEnter', function () {
            SessionsService.getSessions(
                function (data) {
                    $scope.sessions = data;
                },
                function (status) {
                    alert("Error retrieving sessions list (" + status + ")");
                }
            )
        });

        $rootScope.$on('event:auth-logoutCompleted', function (e, rejection) {
            $scope.sessions = null;
        });
    })

    .controller('SessionCtrl', function ($scope, $stateParams, SessionsService) {
        SessionsService.getSession($stateParams.sessionId,
            function (data) {
                $scope.session = data;
            },
            function (status) {
                alert("Error retrieving session information for session " + $stateParams.sessionId + "(" + status + ")");
            });

        $scope.share = function (event) {
            openFB.api({
                method: 'POST',
                path: '/me/feed',
                params: {
                    message: "I'll be attending: '" + $scope.session.title + "' by " +
                    $scope.session.speaker
                },
                success: function () {
                    alert('The session was shared on Facebook');
                },
                error: function () {
                    alert('An error occurred while sharing this session on Facebook');
                }
            });
        };
    })

    .controller('LogoutCtrl', function ($scope, $rootScope, $state, LoginService, UserService, $ionicHistory) {
        $scope.$on('$ionicView.beforeEnter', function () {
            LoginService.logout(
                function (data) {
                    $rootScope.user = UserService.initUser();
                    UserService.setCurrentUser($rootScope.user);
                    $rootScope.isLoggedIn = false;

                    // using the ionicViewService to hide the back button on next view
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });

                    $state.go('app.home', {}, {reload: true, inherit: true});
                    $rootScope.$broadcast('event:auth-logoutCompleted');
                },
                function (status) {
                    alert("Error logging out (" + status + ")");
                })
        })
    });