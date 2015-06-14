angular.module('eddy1.controllers', ['eddy1.services', 'ngResource'])

    .controller('AppCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, $ionicHistory) {

        //Perform auto-login if login details are saved in store
        $rootScope.isLoggedIn = false;
        $rootScope.user = UserService.initUser();

        var currentUser = UserService.getCurrentUser();

        if (currentUser && currentUser.email) {
            //Auto silent login based on the credentials in the storage
            LoginService.login(currentUser,
                function (data) {
                    $rootScope.isLoggedIn = true;
                    $rootScope.user = currentUser;
                },
                function (status, error) {
                    UserService.setCurrentUser(UserService.initUser());
                    ErrorService.logError(status, error, false);
                }
            )
        }

        $rootScope.$on('event:auth-loginRequired', function (e, rejection) {
            $rootScope.user = UserService.getCurrentUser();
            if ($rootScope.user && !$rootScope.user.email) {
                $rootScope.user = UserService.initUser();
            }
            $state.go('app.login', {}, {reload: true, inherit: true});
        });
    })

    .controller('RegisterCtrl', function ($scope, $rootScope, $http, $state, LoginService, UserService, ErrorService, $ionicHistory) {

        $scope.fieldChange = LoginService.fieldChange;

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
                function (status, error) {
                    registrationForm.serverError.innerHTML = error.message;
                    if (error.fieldName) {
                        //Error in a specific field
                        registrationForm[error.fieldName].$invalid = true;
                        if (!registrationForm[error.fieldName].$error) {
                            registrationForm[error.fieldName].$error = {};
                        }
                        registrationForm[error.fieldName].$error.serverError = true;
                    }
                    else {
                        //General Error in the server
                        if (!registrationForm.serverError.$error) {
                            registrationForm.serverError.$error = {};
                        }
                        registrationForm.serverError.$error.serverError = true;
                        ErrorService.logError(status, error, false);
                    }
                });
        };
    })

    .controller('LoginCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, authService, $ionicHistory) {

        $scope.fieldChange = LoginService.fieldChange;

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
                function (status, error) {
                    loginForm.serverError.innerHTML = error.message;
                    if (error.fieldName) {
                        //Error in a specific field
                        loginForm[error.fieldName].$invalid = true;
                        if (!loginForm[error.fieldName].$error) {
                            loginForm[error.fieldName].$error = {};
                        }
                        loginForm[error.fieldName].$error.serverError = true;
                    }
                    else {
                        //General Error in the server
                        if (!loginForm.serverError.$error) {
                            loginForm.serverError.$error = {};
                        }
                        loginForm.serverError.$error.serverError = true;
                        ErrorService.logError(status, error, false);
                    }
                });
        };
    })

    .controller('HomeCtrl', function ($ionicHistory) {
    })

    .controller('PlayCtrl', function ($scope, $state) {
        $scope.play = function () {
            $state.go('app.quiz', {}, {reload: true, inherit: true});
        };
    })

    .controller('QuizCtrl', function ($scope, QuizService, ErrorService) {
        $scope.$on('$ionicView.beforeEnter', function () {
            QuizService.start(
                function (data) {
                    $scope.quiz = data;
                },
                function (status, error) {
                    ErrorService.logError(status, error, true);
                })
        });
    })

    .controller('LogoutCtrl', function ($scope, $rootScope, $state, LoginService, UserService, ErrorService, $ionicHistory) {
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
                function (status, error) {
                    ErrorService.logError(status, error, true);
                })
        })
    });