@echo off
chcp 65001 >nul
title MusiTeacher Games - publish
rem ============================================================
rem  Prepares MusiTeacher Games and publishes it ONLY if you type YES.
rem  1) sync games   2) run tests   3) ask you   4) npx vercel --prod
rem  Stops at the first error. Nothing is published without your YES.
rem ============================================================
cd /d "%~dp0..\musiteacher-games" || goto fail

echo.
echo [1/3] Copying games and building offline lists (sync)...
call node scripts\sync-games.mjs
if errorlevel 1 goto fail

echo.
echo [2/3] Running tests...
call npm test
if errorlevel 1 goto fail

echo.
echo ============================================================
echo  All tests passed. Ready to publish MusiTeacher Games.
echo ============================================================
set "OK="
set /p OK=Publish to the internet now? Type YES and press Enter (anything else = cancel): 
if /I not "%OK%"=="YES" goto skip

echo.
echo [3/3] Publishing (npx vercel --prod)...
call npx vercel --prod
if errorlevel 1 goto fail
echo.
echo DONE - published. Open https://musiteacher-games.vercel.app/api/health to check.
goto end

:skip
echo.
echo Cancelled - nothing was published. Your files are ready; run this file again any time.
goto end

:fail
echo.
echo STOPPED - an error happened above. Nothing was published after the error.
echo Take a screenshot of this window and send it to Claude.

:end
echo.
pause
