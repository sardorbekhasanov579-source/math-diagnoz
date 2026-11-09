@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
echo MATH-DIAGNOZ - ishga tushirish
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js topilmadi. Node.js 22.13 yoki yangisini ornating.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Kutubxonalar ornatilmoqda...
  call npm.cmd install
  if errorlevel 1 (
    echo XATO: npm install bajarilmadi.
    pause
    exit /b 1
  )
)
echo Sayt: http://localhost:5173/
echo API:  http://127.0.0.1:4317/api/status
call npm.cmd run start:all
if errorlevel 1 echo Dasturda xatolik yuz berdi.
pause
endlocal
