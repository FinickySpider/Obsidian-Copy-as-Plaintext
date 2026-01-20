@echo off
REM Launches the PowerShell release script

REM Use pwsh if available, fallback to powershell
where pwsh >nul 2>nul
if %ERRORLEVEL%==0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0release.ps1" %*
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0release.ps1" %*
)
