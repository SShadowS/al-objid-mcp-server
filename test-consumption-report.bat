@echo off
REM Test script to fetch consumption report for an AL app folder
REM Usage: test-consumption-report.bat <app-folder-path>

if "%~1"=="" (
    echo Usage: test-consumption-report.bat ^<app-folder-path^>
    echo.
    echo Example:
    echo   test-consumption-report.bat "C:\MyALApps\MyApp"
    echo   test-consumption-report.bat .\my-al-app
    echo.
    pause
    exit /b 1
)

echo Building MCP server...
call npm run build
if errorlevel 1 (
    echo Failed to build MCP server
    pause
    exit /b 1
)

echo.
echo Running consumption report test...
node test-consumption-report.js "%~1"

pause