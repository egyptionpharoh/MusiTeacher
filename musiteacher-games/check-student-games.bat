@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ===== فحص: أي نسخة طلابية تحتاج تحديثًا؟ (لا ينسخ شيئًا) =====
echo.
node scripts\sync-games.mjs --check
echo.
echo  التقرير محفوظ في: data\check-report.md
pause
