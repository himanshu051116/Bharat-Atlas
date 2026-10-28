@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL%==0 (set "PY=py -3") else (set "PY=python")
%PY% scripts\build.py
if ERRORLEVEL 1 (
  echo Build failed. Install dependencies: %PY% -m pip install -r requirements-geo.txt
  pause
  exit /b 1
)
echo Starting Bharat Atlas LOCAL RESEARCH PREVIEW at http://127.0.0.1:8000
start "" "http://127.0.0.1:8000/"
%PY% -m http.server 8000 --bind 127.0.0.1 --directory dist
