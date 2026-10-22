@echo off
setlocal

set "PORT=%~1"
if "%PORT%"=="" set "PORT=9090"

set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

set "URL=http://localhost:%PORT%"
echo Card Forge starting on %URL%

:: Prefer Node http-server if already installed locally
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  if exist "%DIR%\node_modules\.bin\http-server.cmd" (
    start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 1; Start-Process '%URL%'"
    call npx http-server "%DIR%" -a 127.0.0.1 -p %PORT% -c-1
    exit /b
  )
)

:: Python 3.7+ (needed for --directory). Each candidate is actually run because
:: Windows ships a Microsoft Store placeholder python.exe that only prints an install hint.
set "PYTHON="
for %%P in (py python python3) do (
  if not defined PYTHON (
    %%P -c "import sys; sys.exit(sys.version_info < (3, 7))" >nul 2>nul && set "PYTHON=%%P"
  )
)
if defined PYTHON (
  start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 1; Start-Process '%URL%'"
  echo Press Ctrl+C to stop
  %PYTHON% -m http.server %PORT% --bind 127.0.0.1 --directory "%DIR%"
  exit /b
)

:: Fall back to PowerShell, which is built into Windows
powershell -NoProfile -ExecutionPolicy Bypass -File "%DIR%\serve.ps1" -Port %PORT%
exit /b
