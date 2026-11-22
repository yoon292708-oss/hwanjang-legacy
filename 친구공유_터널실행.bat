@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo [1/2] 환장 래거시 서버를 시작합니다...
start /min "HwanjangLegacy-Server" cmd /c "node server.js"
timeout /t 2 > nul
echo [2/2] 친구 공유용 주소를 생성하는 중입니다... (5~10초 기다려 주세요)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tunnel.ps1"
pause
