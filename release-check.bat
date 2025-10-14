@echo off
echo ========================================
echo AL Object ID Ninja MCP - Release Check
echo ========================================
echo.

echo [1/6] Cleaning dist folder...
if exist dist (
    rmdir /s /q dist
    echo       Cleaned!
) else (
    echo       Already clean!
)
echo.

echo [2/6] Running TypeScript type check...
call npm run typecheck
if %errorlevel% neq 0 (
    echo.
    echo ERROR: TypeScript type check failed!
    exit /b 1
)
echo       Type check passed!
echo.

echo [3/6] Running ESLint...
call npm run lint
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Linting failed!
    exit /b 1
)
echo       Linting passed!
echo.

echo [4/6] Running unit tests (E2E tests skipped)...
call npm run test:unit
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Tests failed!
    exit /b 1
)
echo       Unit tests passed!
echo.

echo [5/6] Building project...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed!
    exit /b 1
)
echo       Build successful!
echo.

echo [6/6] Verifying build output...
if exist dist\v2\server.js (
    echo       Build output verified!
) else (
    echo       ERROR: Build output not found!
    exit /b 1
)
echo.

echo ========================================
echo ✓ ALL CHECKS PASSED!
echo ========================================
echo.
echo Ready for release. Next steps:
echo   1. Commit your changes: git add -A ^&^& git commit -m "Release v2.0.1"
echo   2. Tag the release: git tag v2.0.1
echo   3. Push to GitHub: git push origin master --tags
echo   4. Publish to npm: npm publish
echo.