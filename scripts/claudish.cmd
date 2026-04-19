@echo off
REM Claudish Windows Launcher
REM Bypasses the broken Node.js Bun-finder (uses Unix "which" command)
REM by calling Bun directly.
REM
REM SETUP: Edit the two paths below to match your Windows username.
REM Then copy this file to: %APPDATA%\npm\claudish.cmd

"C:\Users\%USERNAME%\.bun\bin\bun.exe" "C:\Users\%USERNAME%\.bun\install\cache\claudish@7.0.1@@@1\dist\index.js" %*
