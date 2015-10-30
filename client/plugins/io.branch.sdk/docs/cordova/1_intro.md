# Full Documentation for Cordova SDK

This documentation outlines the functionality of the Branch Metrics Cordova SDK, and how to easily incorporate it into a Cordova app. The Cordova SDK shares the same code base as the Branch Web SDK, and includes functions to call all of the same API endpoints.

Live demo of the Web SDK: [https://cdn.branch.io/example.html](https://cdn.branch.io/example.html)

To use the Cordova SDK, you'll need to first initialize it with your Branch Key found in your [Branch dashboard](https://dashboard.branch.io/#/settings). You'll also need to register when your users login with `setIdentity`, and when they logout with `logout`.

### Register you app

You can sign up for your own Branch Key at [https://dashboard.branch.io](https://dashboard.branch.io)

### Quick Install of Cordova/Phonegap SDK

This Web SDK can also be used for Cordova/Phonegap applications.  It is provided as a plugin and can be installed with Cordova plugin or the Plugman tool.  Point the tool at this repositry, https://github.com/BranchMetrics/Cordova-Ionic-PhoneGap-Deferred-Deep-Linking-SDK.  For example:

```sh
cordova plugin add https://github.com/BranchMetrics/Cordova-Ionic-PhoneGap-Deferred-Deep-Linking-SDK
```

Note that this SDK is meant for use with full Cordova/PhoneGap apps.  If you are building a hybrid app using an embedded web view and you want to access the Branch API from native code you will want to use the platform specific SDKs and pass data into Javascript if needed.

### Running Cordova Testbed App
This repo includes a sample app, that demonstrates all of the available methods in the Branch Cordova SDK.
Building this app is very simple:

Switch to the Cordova dir
```js
$ cd cordova-testbed
```

Run the init script to install all the required plugins
```js
$ ./init.sh
```

Build the Cordova app and launch in the iOS emulator
```sh
$ cordova emulate ios
```

#### Initialization and Event Handling

You should initialize the Branch SDK session once the 'deviceready' event fires and each time the 'resume' event fires.  See the example code below. You will need your Branch Key from the Branch dashboard.

```js
  branch.init("YOUR BRANCH KEY HERE", function(err, data) {
  	app.initComplete(err, data);
  });
```
**[Formerly `getInstance() and initSession()`](CORDOVA_UPGRADE_GUIDE.md)**

Here is the location of the Branch Key that you will need for the `branch.init` call above (_formerly app id, which is now depreciated_):

![app id](https://raw.githubusercontent.com/BranchMetrics/Smart-App-Banner-Deep-Linking-Web-SDK/master/resources/app_id.png)

The session close will be sent automatically on any 'pause' event.

_____

#### Register an activity for direct deep linking (optional but recommended)

In your project's manifest file, you can register your app to respond to direct deep links (yourapp:// in a mobile browser) by adding the second intent filter block. Also, make sure to change **yourapp** to a unique string that represents your app name.

Secondly, make sure that this activity is launched as a singleTask. This is important to handle proper deep linking from other apps like Facebook.

Typically, you would register some sort of splash activity that handles routing for your app.

```xml
<activity
	android:name="com.yourapp.SplashActivity"
	android:label="@string/app_name"
	<!-- Make sure the activity is launched as "singleTask" -->
	android:launchMode="singleTask"
	 >
	<intent-filter>
		<action android:name="android.intent.action.MAIN" />
		<category android:name="android.intent.category.LAUNCHER" />
	</intent-filter>

	<!-- Add this intent filter below, and change yourapp to your app name -->
	<intent-filter>
		<data android:scheme="yourapp" android:host="open" />
		<action android:name="android.intent.action.VIEW" />
		<category android:name="android.intent.category.DEFAULT" />
		<category android:name="android.intent.category.BROWSABLE" />
	</intent-filter>
</activity>
```
_____

### iOS plist

#### Add your Branch Key to your project

After you register your app, your Branch Key can be retrieved on the [Settings](https://dashboard.branch.io/#/settings) page of the dashboard. Now you need to add it to YourProject-Info.plist (Info.plist for Swift).

1. In plist file, mouse hover "Information Property List" which is the root item under the Key column.
1. After about half a second, you will see a "+" sign appear. Click it.
1. In the newly added row, fill in "branch_key" for its key, leave type as String, and enter your app's Branch Key obtained in above steps in the value column.
1. Save the plist file.

#### Register a URI scheme direct deep linking (optional but recommended)

You can register your app to respond to direct deep links (yourapp:// in a mobile browser) by adding a URI scheme in the YourProject-Info.plist file. Make sure to change **yourapp** to a unique string that represents your app name.

1. In Xcode, click on YourProject-Info.plist on the left.
1. Find URL Types and click the right arrow. (If it doesn't exist, right click anywhere and choose Add Row. Scroll down and choose URL Types)
1. Add "yourapp", where yourapp is a unique string for your app, as an item in URL Schemes as below:

![URL Scheme Demo](https://s3-us-west-1.amazonaws.com/branchhost/urlScheme.png)

Alternatively, you can add the URI scheme in your project's Info page.

1. In XCode, click your project in the Navigator (on the left side).
1. Select the "Info" tab.
1. Expand the "URL Types" section at the bottom.
1. Click the "+" sign to add a new URI Scheme, as below:

![URL Scheme Demo](https://s3-us-west-1.amazonaws.com/branchhost/urlType.png)

_____

### SDK Method Queue

Initializing the SDK is an asynchronous method with a callback, so it may seem as though you would need to place any method calls that will execute immediately inside the `branch.init()` callback. We've made it even easier than that, by building in a queue to the SDK! The only thing that is required is that `branch.init()` is called prior to any other methods. All SDK methods called are guaranteed to: 1. be executed in the order that they were called, and 2. wait to execute until the previous SDK method finishes. Therefore, it is 100% allowable to do something like:

```js
branch.init(...);
branch.banner(...);
```

If `branch.init()` fails, all subsequent branch methods will fail.

## API Reference

