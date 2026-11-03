@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Chua cai Node.js. Tai ban LTS tai https://nodejs.org roi chay lai.
  pause
  exit /b 1
)
node scripts\serve.mjs
pause
