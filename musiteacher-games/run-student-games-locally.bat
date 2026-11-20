@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  تشغيل MusiTeacher Games على جهازك: افتح http://localhost:5400
echo  (للإيقاف: أغلق هذه النافذة)
echo.
node scripts\dev-server.mjs
pause
