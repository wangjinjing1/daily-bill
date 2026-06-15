@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo Daily Bill Android APK Release Build
echo ============================================

powershell -ExecutionPolicy Bypass -File ".\scripts\build-android.ps1" -BuildType release -PromptForInput

echo.
if errorlevel 1 (
  echo Build failed.
) else (
  echo Build completed.
)
echo.
pause
