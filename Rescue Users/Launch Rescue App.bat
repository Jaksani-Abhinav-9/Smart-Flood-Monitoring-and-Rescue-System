@echo off
title FloodGuard Rescue Command Terminal
cd /d "%~dp0"
color 0B

echo ====================================================================
echo    FLOODGUARD AI 2.0 - RESCUE COMMAND ^& OPERATIONS TERMINAL
echo      Autonomous NDRF/SDRF Field Unit ^| 100%% Offline Tactical
echo ====================================================================
echo.
echo [*] Checking Python runtime environment...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python 3 is not found in system PATH!
    echo Please install Python 3.10+ from python.org and tick "Add to PATH".
    echo.
    pause
    exit /b 1
)

python -c "import webview, serial" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [*] Installing runtime packages from local offline bundle...
    pip install --no-index --find-links=scripts\offline_packages pywebview bottle pyserial typing_extensions proxy_tools >nul 2>&1
)

echo [*] Initializing FloodGuard Native Desktop Terminal...
python run_rescue_app.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ====================================================================
    echo [NOTICE] Launcher exited with error code %ERRORLEVEL%.
    echo ====================================================================
    pause
) else (
    exit
)
