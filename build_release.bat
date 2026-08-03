@echo off
cd /d C:\Users\kubai\IdeaProjects\MediKit\MediKit\android
call gradlew.bat :react-native-vision-camera:assembleRelease assembleRelease
echo BUILD_EXIT_CODE=%ERRORLEVEL%
