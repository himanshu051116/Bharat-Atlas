@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
 echo Python Launcher not found. Install Python from python.org, or run: python -m http.server 8000
 pause
 exit /b 1
)
echo Bharat Atlas India + World Explorer — LOCAL RESEARCH PREVIEW ONLY
start "" "http://127.0.0.1:8000/"
py -3 -m http.server 8000 --bind 127.0.0.1
pause
