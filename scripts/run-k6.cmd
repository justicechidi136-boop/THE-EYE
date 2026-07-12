@echo off
setlocal

set "ROOT=%~dp0.."
set "K6_SCRIPT=%~1"
if "%K6_SCRIPT%"=="" set "K6_SCRIPT=smoke.js"

where k6 >nul 2>&1
if errorlevel 1 (
  echo k6 is not installed. Install from https://grafana.com/docs/k6/latest/set-up/install-k6/
  exit /b 1
)

if not exist "%ROOT%\k6\%K6_SCRIPT%" (
  echo Script not found: %ROOT%\k6\%K6_SCRIPT%
  exit /b 1
)

if exist "%ROOT%\k6\.env" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%\k6\.env") do (
    if not "%%A"=="" if not "%%A:~0,1%"=="#" set "%%A=%%B"
  )
)

pushd "%ROOT%\.."
k6 run "scripts\k6\%K6_SCRIPT%"
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
