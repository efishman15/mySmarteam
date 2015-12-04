del "C:\Dev\topTeamer\client\platforms\android\build\outputs\apk\topteamer.apk"
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore "C:\Users\Eddy\.android\release.keystore" -keypass 1Mdollar -storepass 1Mdollar "C:\Dev\topTeamer\client\platforms\android\build\outputs\apk\android-release-unsigned.apk" FPLabs
zipalign -v 4 "C:\Dev\topTeamer\client\platforms\android\build\outputs\apk\android-release-unsigned.apk" "C:\Dev\topTeamer\client\platforms\android\build\outputs\apk\topteamer.apk"
copy "C:\Dev\topTeamer\client\platforms\android\build\outputs\apk\topteamer.apk" "C:\Dev\topTeamer\client\www\topteamer.apk"
C:
cd C:\Dev