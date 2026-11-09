@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
if not exist ".env" (
 echo XATO: .env fayli topilmadi.
 echo .env.example ni .env deb nomlang va Neon DATABASE_URL ni u yerga kiriting.
 pause
 exit /b 1
)
echo === MATH-DIAGNOZ - SQLite dan Neon PostgreSQL ga ===
echo Eslatma: oldingi serverni toxtating. Eski SQLite bazani ochirmang.
echo.
node server\find-local-databases.mjs
echo.
set "SOURCE=%~dp0server\data\math-diagnoz.sqlite"
set /p "INPUT=Ko'chiriladigan SQLite faylining TOLIQ manzilini kiriting (Enter: shu papkaning bazasi): "
if not "%INPUT%"=="" set "SOURCE=%INPUT%"
set "SOURCE=%SOURCE:"=%"
if not exist "%SOURCE%" (
 echo XATO: tanlangan SQLite fayli topilmadi.
 pause
 exit /b 2
)
echo.
echo Tanlangan fayl: "%SOURCE%"
set /p "ANSWER=Davom etish uchun HA deb yozing: "
if /i not "%ANSWER%"=="HA" (
 echo Bekor qilindi.
 pause
 exit /b 0
)
node --env-file=.env server\migrate-sqlite-to-neon.mjs "%SOURCE%"
echo.
pause
