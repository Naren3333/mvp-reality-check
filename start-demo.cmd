@echo off
setlocal
cd /d "%~dp0"
set "PORT=4176"
echo.
echo MVP Reality Check will stay available at http://localhost:4176
echo Keep this window open while you use the demo. Press Ctrl+C to stop it.
echo.
"C:\Program Files\nodejs\node.exe" server.mjs
echo.
echo The local server stopped. Press any key to close this window.
pause >nul
endlocal
