cordova.define('cordova/plugin_list', function(require, exports, module) {
module.exports = [
    {
        "file": "plugins/com.ionic.keyboard/www/keyboard.js",
        "id": "com.ionic.keyboard.keyboard",
        "clobbers": [
            "cordova.plugins.Keyboard"
        ]
    },
    {
        "file": "plugins/com.smartmobilesoftware.androidinappbilling/www/inappbilling.js",
        "id": "com.smartmobilesoftware.androidinappbilling.InAppBillingPlugin",
        "clobbers": [
            "inappbilling"
        ]
    },
    {
        "file": "plugins/cordova-plugin-facebook4/www/facebookConnectPlugin.js",
        "id": "cordova-plugin-facebook4.FacebookConnectPlugin",
        "clobbers": [
            "facebookConnectPlugin"
        ]
    },
    {
        "file": "plugins/cordova-plugin-inappbrowser/www/inappbrowser.js",
        "id": "cordova-plugin-inappbrowser.inappbrowser",
        "clobbers": [
            "cordova.InAppBrowser.open",
            "window.open"
        ]
    },
    {
        "file": "plugins/cordova-plugin-splashscreen/www/splashscreen.js",
        "id": "cordova-plugin-splashscreen.SplashScreen",
        "clobbers": [
            "navigator.splashscreen"
        ]
    },
    {
        "file": "plugins/cordova-plugin-whitelist/whitelist.js",
        "id": "cordova-plugin-whitelist.whitelist",
        "runs": true
    },
    {
        "file": "plugins/cordova-plugin-x-socialsharing/www/SocialSharing.js",
        "id": "cordova-plugin-x-socialsharing.SocialSharing",
        "clobbers": [
            "window.plugins.socialsharing"
        ]
    },
    {
        "file": "plugins/io.branch.sdk/dist/build.js",
        "id": "io.branch.sdk.branch",
        "clobbers": [
            "branch",
            "Branch"
        ]
    },
    {
        "file": "plugins/org.apache.cordova.device/www/device.js",
        "id": "org.apache.cordova.device.device",
        "clobbers": [
            "device"
        ]
    },
    {
        "file": "plugins/phonegap-plugin-push/www/push.js",
        "id": "phonegap-plugin-push.PushNotification",
        "clobbers": [
            "PushNotification"
        ]
    },
    {
        "file": "plugins/uk.co.whiteoctober.cordova.appversion/www/AppVersionPlugin.js",
        "id": "uk.co.whiteoctober.cordova.appversion.AppVersionPlugin",
        "clobbers": [
            "cordova.getAppVersion"
        ]
    }
];
module.exports.metadata = 
// TOP OF METADATA
{
    "com.ionic.keyboard": "1.0.4",
    "com.smartmobilesoftware.androidinappbilling": "3.0.2",
    "cordova-plugin-facebook4": "1.0.0",
    "cordova-plugin-inappbrowser": "1.0.2-dev",
    "cordova-plugin-splashscreen": "2.1.0",
    "cordova-plugin-whitelist": "1.0.0",
    "cordova-plugin-x-socialsharing": "5.0.4",
    "io.branch.sdk": "1.7.0",
    "org.apache.cordova.device": "0.3.0",
    "phonegap-plugin-push": "1.3.0",
    "uk.co.whiteoctober.cordova.appversion": "0.1.7"
}
// BOTTOM OF METADATA
});