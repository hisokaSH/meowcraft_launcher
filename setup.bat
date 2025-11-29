@echo off
echo ========================================
echo MeowCraft Launcher - Quick Setup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js found: 
node --version
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm is not installed!
    pause
    exit /b 1
)

echo npm found:
npm --version
echo.

REM Install dependencies
echo Installing dependencies...
echo This may take 5-10 minutes on first run...
echo.
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install dependencies!
    echo Check your internet connection and try again.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo What would you like to do?
echo.
echo 1. Run in Development Mode (with hot-reload)
echo 2. Build for Windows (creates .exe installer)
echo 3. Exit
echo.

set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo.
    echo Starting development mode...
    echo The launcher will open automatically.
    echo Press Ctrl+C to stop.
    echo.
    call npm run dev
) else if "%choice%"=="2" (
    echo.
    echo Building for Windows...
    echo This may take a few minutes...
    echo.
    call npm run build:win
    echo.
    echo Build complete! Check the 'release' folder.
    pause
) else (
    echo.
    echo Exiting...
)

echo.
pause
