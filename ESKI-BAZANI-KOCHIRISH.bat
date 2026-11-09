@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "SOURCE=%~dp0..\MATH-DIAGNOZ-ESKI\server\data"
set "TARGET=%~dp0server\data"
echo.
echo =============================================
echo MATH-DIAGNOZ - ESKI BAZANI KOCHIRISH
 echo =============================================
echo Avval ESKI va YANGI serverlarni yoping.
echo.
echo ESKI: "%SOURCE%"
echo YANGI: "%TARGET%"
echo.
if not exist "%SOURCE%\math-diagnoz.sqlite" (
  echo XATO: eski math-diagnoz.sqlite bazasi topilmadi.
  echo Eski papka MATH-DIAGNOZ-ESKI deb atalishi
  echo va yangi MATH-DIAGNOZ papkasi bilan yonma-yon turishi kerak.
  echo Eski loyiha papkasini OCHIRMANG.
  pause
  exit /b 1
)
if exist "%TARGET%\math-diagnoz.sqlite" (
  echo TOXTADI: yangi loyihada baza allaqachon mavjud.
  echo Xavfsizlik uchun eski baza uning ustiga yozilmadi.
  echo Yangi server yopilganini tekshiring va xabar bering.
  pause
  exit /b 1
)
if not exist "%TARGET%" (
  mkdir "%TARGET%"
  if errorlevel 1 (
    echo XATO: yangi data papkasini yaratib bolmadi.
    pause
    exit /b 1
  )
)
where robocopy >nul 2>nul
if errorlevel 1 (
  echo XATO: Windows robocopy dasturi topilmadi.
  pause
  exit /b 1
)
robocopy "%SOURCE%" "%TARGET%" /E /R:1 /W:1 >nul
if errorlevel 8 (
  echo XATO: nusxalash amalga oshmadi.
  echo Papka ruxsatlari va serverlar yopilganini tekshiring.
  pause
  exit /b 1
)
if not exist "%TARGET%\math-diagnoz.sqlite" (
  echo XATO: ma'lumotlar bazasi nusxalanmadi.
  pause
  exit /b 1
)
echo.
echo MUVAFFAQIYAT! Eski bazadan nusxa olindi.
echo Endi yangi loyiha papkasini VS Code orqali oching.
echo Terminalda: npm.cmd install
echo Keyin: npm.cmd run start:all
pause
endlocal
