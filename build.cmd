@echo off
setlocal
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo   Non trovo csc.exe di .NET Framework 4: impossibile compilare Sguardo.
  exit /b 1
)
if not exist "%~dp0bin" mkdir "%~dp0bin"
"%CSC%" /nologo /codepage:65001 /target:exe /optimize+ /out:"%~dp0bin\sguardo.exe" /r:System.Core.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll "%~dp0src\*.cs"
if errorlevel 1 (
  echo   Compilazione non riuscita.
  exit /b 1
)
echo   Compilato: %~dp0bin\sguardo.exe
exit /b 0
