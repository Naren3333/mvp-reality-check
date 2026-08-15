@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist ".local-data" mkdir ".local-data"
netstat -ano | findstr /r /c:":4173 .*LISTENING" >nul
if not errorlevel 1 goto open_browser

echo Starting MVP Reality Check at http://localhost:4173 ...
start "MVP Reality Check local server" /min cmd.exe /d /c "set PORT=4173&& node server.mjs > .local-data\server.log 2>&1"
ping 127.0.0.1 -n 3 >nul

:open_browser
start "" http://127.0.0.1:4173
endlocal
