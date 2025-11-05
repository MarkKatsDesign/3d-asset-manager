@echo off
echo ========================================
echo PocketBase Setup for Windows
echo ========================================
echo.

cd /d "%~dp0"

if not exist "pocketbase.exe" (
    echo Downloading PocketBase...
    echo.
    echo Please download PocketBase manually from:
    echo https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_windows_amd64.zip
    echo.
    echo Extract pocketbase.exe to the backend folder and run this script again.
    echo.
    pause
    exit /b
)

echo Starting PocketBase...
echo.
echo IMPORTANT: First time setup
echo 1. Open your browser to: http://localhost:8090/_/
echo 2. Create your admin account
echo 3. We'll then create the assets collection
echo.

pocketbase.exe serve
