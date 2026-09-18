@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found.
  echo Install the LTS version of Node.js from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

echo Installing dependencies...
call npm install
if errorlevel 1 goto :failed

echo Building Windows EXE files...
call npm run build
if errorlevel 1 goto :failed

echo.
echo Build completed. Output folder:
echo %~dp0dist
start "" "%~dp0dist"
pause
exit /b 0

:failed
echo.
echo [ERROR] Build failed. See the messages above.
pause
exit /b 1
