@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo Daily Bill Android APK Release Build
echo ============================================
echo.
echo Please enter your backend API URL.
echo Example: http://192.168.1.10:13101/api
echo.
set /p API_URL=Enter API URL: 

if "%API_URL%"=="" (
  echo API URL is required for release build.
  echo.
  pause
  exit /b 1
)

powershell -ExecutionPolicy Bypass -File ".\scripts\build-android.ps1" -BuildType release -ApiBaseUrl "%API_URL%"

echo.
if errorlevel 1 (
  echo Build failed.
) else (
  echo Build completed.
)
echo.
pause
