@echo off
setlocal
cd /d "%~dp0"

node scripts\demo-launcher.mjs --open
if errorlevel 1 pause
endlocal
