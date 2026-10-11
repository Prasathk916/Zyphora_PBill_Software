@echo off
title Zyphora PBilling Launcher
cd /d "%~dp0"
echo ==============================================
echo     Starting Zyphora PBilling Application...
echo ==============================================
npm start
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Application exited or encountered an error.
    pause
)
