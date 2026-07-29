@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if "%~1"=="" goto :dev
if /i "%~1"=="dev" goto :dev
if /i "%~1"=="light" goto :light
if /i "%~1"=="lite" goto :light
if /i "%~1"=="l" goto :light
if /i "%~1"=="all" goto :all
if /i "%~1"=="infra" goto :infra
if /i "%~1"=="up" goto :infra
if /i "%~1"=="down" goto :down
if /i "%~1"=="reset" goto :reset
if /i "%~1"=="api" goto :api
if /i "%~1"=="worker" goto :worker
if /i "%~1"=="web" goto :web
if /i "%~1"=="help" goto :help
if /i "%~1"=="-h" goto :help
if /i "%~1"=="/?" goto :help

echo Unknown command: %~1
echo.
goto :help

:dev
echo [r] infra + API + Worker + Web
call npm run dev
exit /b %ERRORLEVEL%

:light
echo [r] light: postgres+redis + API + Web ^(no elastic, no worker^)
call npm run dev:light
exit /b %ERRORLEVEL%

:all
echo [r] API + Worker + Web (infra skip)
call npm run dev:all
exit /b %ERRORLEVEL%

:infra
echo [r] docker infra up
call npm run infra:up
exit /b %ERRORLEVEL%

:down
echo [r] docker infra down
call npm run infra:down
exit /b %ERRORLEVEL%

:reset
echo [r] wipe local search/test data ^(DB + ES + Redis^)
call npm run reset:dev-data -- %2 %3 %4
exit /b %ERRORLEVEL%

:api
echo [r] API only
call npm run start:dev:api
exit /b %ERRORLEVEL%

:worker
echo [r] Worker only
call npm run start:worker:dev
exit /b %ERRORLEVEL%

:web
echo [r] Web only
call npm run web:dev
exit /b %ERRORLEVEL%

:help
echo.
echo Usage: r [command]
echo.
echo   (none) / dev   infra + API + Worker + Web   ^(npm run dev^)
echo   light / lite / l  postgres+redis + API + Web ^(no elastic/worker^)
echo   all            API + Worker + Web only      ^(npm run dev:all^)
echo   infra / up     postgres redis elastic up
echo   down           infra stop
echo   reset          wipe search/test data ^(YES confirm; -Force ok^)
echo   api            API watch only
echo   worker         Worker only
echo   web            Vite dashboard only
echo   help           this help
echo.
echo URLs:
echo   Web  http://127.0.0.1:5173
echo   API  http://127.0.0.1:3100
echo.
exit /b 0
