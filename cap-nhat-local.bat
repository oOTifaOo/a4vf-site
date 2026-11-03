@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Chua cai Node.js. Tai ban LTS tai https://nodejs.org roi chay lai.
  pause
  exit /b 1
)
if exist sheet-url.txt set /p SHEET_CSV_URL=<sheet-url.txt
node scripts\update.mjs
if errorlevel 1 (
  echo.
  echo CO LOI - xem thong bao o tren. data.js cu duoc giu nguyen.
) else (
  echo.
  echo XONG. Quay lai trinh duyet va nhan Ctrl+F5.
)
pause
