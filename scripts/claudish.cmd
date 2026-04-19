@echo off
REM Claudish Windows Launcher
REM
REM SETUP: Copy this file to %APPDATA%\npm\claudish.cmd
REM        Optionally set CLAUDISH_HOME env var if you move the folder:
REM          setx CLAUDISH_HOME "D:\your\new\path\Claude-Code-Multi-Models"
REM        Otherwise it defaults to the path below.

if "%CLAUDISH_HOME%"=="" set CLAUDISH_HOME=C:\Users\%USERNAME%\Documents\Claude-Code-Multi-Models
"%USERPROFILE%\.bun\bin\bun.exe" "%CLAUDISH_HOME%\claudish-dist.js" %*
