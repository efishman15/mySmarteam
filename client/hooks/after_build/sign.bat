del "C:\Dev\whoSmarter\client\platforms\android\build\outputs\apk\whoSmarter.apk"
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore "C:\Users\Eddy\.android\release.keystore" -keypass 1Mdollar -storepass 1Mdollar "C:\Dev\whoSmarter\client\platforms\android\build\outputs\apk\android-release-unsigned.apk" FPLabs
zipalign -v 4 "C:\Dev\whoSmarter\client\platforms\android\build\outputs\apk\android-release-unsigned.apk" "C:\Dev\whoSmarter\client\platforms\android\build\outputs\apk\whoSmarter.apk"
