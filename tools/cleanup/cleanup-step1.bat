@echo off
chcp 65001 >nul
echo MusiTeacher cleanup - step 1 (moves unused backups to a quarantine folder outside the project)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cleanup-step1.ps1"
pause
