@echo off
setlocal

set PORT=%~1
if "%PORT%"=="" set PORT=9090

set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

echo Card Forge starting on http://localhost:%PORT%

:: Prefer Node http-server if already installed locally
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  if exist "%DIR%\node_modules\.bin\http-server.cmd" (
    start "" "http://localhost:%PORT%"
    npx http-server "%DIR%" -p %PORT% -c-1
    exit /b
  )
)

:: Fall back to Python 3 / Python
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  start "" "http://localhost:%PORT%"
  python -m http.server %PORT% --directory "%DIR%"
  exit /b
)

where python3 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  start "" "http://localhost:%PORT%"
  python3 -m http.server %PORT% --directory "%DIR%"
  exit /b
)

echo Error: No suitable server found. Install python or run: npx http-server -p %PORT%
exit /b 1
