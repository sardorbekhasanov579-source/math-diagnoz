@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title MATH-DIAGNOZ - BIR MAKTAB SERVERI

echo ============================================
echo MATH-DIAGNOZ - MAKTAB TARMOQ SINOVI
 echo ============================================
echo Server kompyuterida Wi-Fi yoki LAN yoqilgan bolsin.
echo.
where node >nul 2>nul
if errorlevel 1 (
 echo XATO: Node.js topilmadi. Node.js 22.13+ ornating.
 pause
 exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
 echo Kutubxonalar yoq. npm.cmd install bajarilmoqda...
 call npm.cmd install
 if errorlevel 1 (
   echo XATO: npm.cmd install muvaffaqiyatsiz.
   pause
   exit /b 1
 )
)
echo Maktab sayti: npm.cmd run build:school
call npm.cmd run build:school
if errorlevel 1 (
 echo XATO: Build yakunlanmadi. VS Code terminaldagi xatoni tekshiring.
 pause
 exit /b 1
)
echo.
echo Maktab serveri ochilmoqda...
call npm.cmd run school
if errorlevel 1 (
 echo XATO: Maktab serveri ishga tushmadi.
 pause
 exit /b 1
)
pause
