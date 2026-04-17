@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo Daily Bill Android APK Debug Build
echo ==========================================
echo.
echo Default API URL for Android emulator:
echo http://10.0.2.2:13101/api
echo.
set /p API_URL=Enter API URL (press Enter to use default): 

if "%API_URL%"=="" (
  powershell -ExecutionPolicy Bypass -File ".\scripts\build-android.ps1" -BuildType debug
) else (
  powershell -ExecutionPolicy Bypass -File ".\scripts\build-android.ps1" -BuildType debug -ApiBaseUrl "%API_URL%"
)

echo.
if errorlevel 1 (
  echo Build failed.
) else (
  echo Build completed.
)
echo.
pause
