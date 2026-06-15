@echo off
echo Installing QueueCure backend dependencies...
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "d:\ECS VI\MINI project\Queue Cure '26\backend"
node --version
npm --version
npm install
echo.
echo === Installation complete! ===
echo.
echo To start the server, run:
echo   npm run dev
echo.
pause
