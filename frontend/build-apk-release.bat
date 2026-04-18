@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo Daily Bill Android APK Release Build
echo ============================================
echo.
echo Please enter your backend API URL.
echo Example: 请输入自己的后端服务地址
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
