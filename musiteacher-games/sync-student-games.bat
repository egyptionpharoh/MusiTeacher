@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ===== MusiTeacher Games: نسخ/تحديث الألعاب الطلابية من MusiTeacher =====
echo  (لا يغيّر أي ملف في الألعاب الأصلية)
echo.
node scripts\sync-games.mjs
echo.
echo  التقرير محفوظ في: data\sync-report.md
pause
