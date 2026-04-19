@echo off
REM Local Claudish launcher — runs the patched dist from this folder
REM Usage: start-claudish.cmd --model go@gemini-2.5-pro "your task"
REM        start-claudish.cmd --model cx@gpt-5.4 "your task"

"%USERPROFILE%\.bun\bin\bun.exe" "%~dp0claudish-dist.js" %*
