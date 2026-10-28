@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL%==0 (set "PY=py -3") else (set "PY=python")
echo Installing Bharat Atlas world-geography tools. Downloads are public-domain Natural Earth reference datasets.
%PY% -m pip install -r requirements-geo.txt
if ERRORLEVEL 1 goto fail
%PY% scripts\install_world_geography.py --download --replace
if ERRORLEVEL 1 goto fail
%PY% scripts\build.py
if ERRORLEVEL 1 goto fail
%PY% scripts\verify_preview.py
if ERRORLEVEL 1 goto fail
echo.
echo Research geography installed and built. Launch START_LOCAL_WINDOWS.bat to view it.
pause
exit /b 0
:fail
echo.
echo Download/import/build failed. Existing atlas data should remain unchanged unless import succeeded.
echo Check output above. Your supplied India outline is never modified by this installer.
pause
exit /b 1
