@echo off
rem Compila solo se manca: con Smart App Control ogni nuovo exe viene rivalutato.
if not exist "%~dp0bin\sguardo.exe" call "%~dp0build.cmd"
if not exist "%~dp0bin\sguardo.exe" exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0src\test.ps1"
exit /b %errorlevel%
