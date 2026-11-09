@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".env" (
 echo .env yoq. .env.example ni .env ga nusxalang va Neon DATABASE_URL ni kiriting.
 pause
 exit /b 1
)
node --env-file=.env server\check-neon.mjs
pause
