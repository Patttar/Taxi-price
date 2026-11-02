@echo off
echo Запускаю сайт...
cd /d "%~dp0"
start "" "http://localhost:5173/mysite/"
npm run dev
pause
