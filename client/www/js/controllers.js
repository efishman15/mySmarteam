angular.module('eddy1.controllers', ['eddy1.services', 'ngResource'])

    .controller('AppCtrl', function ($scope, $rootScope, $state, LoginService, UserService, $ionicHistory) {

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

    .controller('RegisterCtrl', function ($scope, $rootScope, $http, $state, LoginService, UserService, $ionicHistory) {
        $rootScope.user = UserService.initUser();

        $scope.register = function (registrationForm) {

            var user = UserService.initUser();
            user.email = registrationForm.email.$modelValue;
            user.password = registrationForm.password.$modelValue;

            LoginService.register(user,
                function (data) {
                    UserService.setCurrentUser(user);
                    $rootScope.isLoggedIn = true;
                    $rootScope.user = user;

                    $ionicHistory.clearHistory();
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });
                    $state.go('app.play', {}, {reload: true, inherit: true});
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


    .controller('LoginCtrl', function ($scope, $rootScope, $state, LoginService, UserService, authService, $ionicHistory) {
        $scope.message = "";
        $rootScope.user = UserService.initUser();

        $scope.login = function (loginForm) {

            var user = UserService.initUser();
            user.email = loginForm.email.$modelValue;
            user.password = loginForm.password.$modelValue;

            LoginService.login(user,
                function (data) {
                    UserService.setCurrentUser(user);
                    $rootScope.isLoggedIn = true;
                    $rootScope.user = user;
                    authService.loginConfirmed(); //will release queued http requests

                    $ionicHistory.clearHistory();
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });

                    $state.go('app.play', {}, {reload: true, inherit: true});
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
    })

    .controller('PlayCtrl', function ($scope) {
        $scope.play = function () {
            alert("Play...");
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