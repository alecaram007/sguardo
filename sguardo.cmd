@echo off
if not exist "%~dp0bin\sguardo.exe" (
  call "%~dp0build.cmd" >nul
  if errorlevel 1 (
    echo   Non riesco a compilare Sguardo: prova a lanciare build.cmd per vedere l'errore.
    exit /b 2
  )
)
"%~dp0bin\sguardo.exe" %*
exit /b %errorlevel%
