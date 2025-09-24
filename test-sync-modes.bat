@echo off
REM Test script to verify sync modes functionality
REM Usage: test-sync-modes.bat <app-folder-path> [merge|replace]

if "%~1"=="" (
    echo Usage: test-sync-modes.bat ^<app-folder-path^> [merge^|replace]
    echo.
    echo Examples:
    echo   test-sync-modes.bat "C:\MyALApps\MyApp" merge
    echo   test-sync-modes.bat .\my-al-app replace
    echo   test-sync-modes.bat .\my-al-app  ^(defaults to merge^)
    echo.
    echo Sync Modes:
    echo   merge   - UPDATE/MERGE mode ^(PATCH^) - merges with existing data
    echo   replace - REPLACE mode ^(POST^) - completely replaces data
    echo.
    pause
    exit /b 1
)

set "SYNC_MODE=%~2"
if "%SYNC_MODE%"=="" set "SYNC_MODE=merge"

echo Building MCP server...
call npm run build
if errorlevel 1 (
    echo Failed to build MCP server
    pause
    exit /b 1
)

echo.
echo Running sync modes test with mode: %SYNC_MODE%
node test-sync-modes.js "%~1" "%SYNC_MODE%"

pause