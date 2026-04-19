@echo off
REM Multi-agent fleet launcher
REM Starts Claudish on different ports, one per agent/department
REM Each agent: open a new Claude Code session pointed at its port
REM
REM Usage: launch-agents.cmd
REM Then in each agent terminal:
REM   set ANTHROPIC_BASE_URL=http://localhost:<PORT>
REM   claude

set BUN="%USERPROFILE%\.bun\bin\bun.exe"
set DIST="%~dp0claudish-dist.js"

echo Starting Claudish agents...

REM Agent 1 — Gemini (port 3001)
start "Agent-1-Gemini" cmd /k "%BUN% %DIST% --model go@gemini-2.5-pro --port 3001"

REM Agent 2 — Gemini (port 3002)
start "Agent-2-Gemini" cmd /k "%BUN% %DIST% --model go@gemini-2.5-pro --port 3002"

REM Agent 3 — Gemini (port 3003)
start "Agent-3-Gemini" cmd /k "%BUN% %DIST% --model go@gemini-2.5-pro --port 3003"

REM Agent 4 — Gemini (port 3004)
start "Agent-4-Gemini" cmd /k "%BUN% %DIST% --model go@gemini-2.5-flash --port 3004"

REM Agent 5 — Gemini (port 3005)
start "Agent-5-Gemini" cmd /k "%BUN% %DIST% --model go@gemini-2.5-flash --port 3005"

REM Agent 6 — Codex (port 3006)
start "Agent-6-Codex" cmd /k "%BUN% %DIST% --model cx@gpt-5.4 --port 3006"

REM Agent 7 — Codex (port 3007)
start "Agent-7-Codex" cmd /k "%BUN% %DIST% --model cx@gpt-5.4 --port 3007"

REM Agent 8 — Codex (port 3008)
start "Agent-8-Codex" cmd /k "%BUN% %DIST% --model cx@gpt-5.4 --port 3008"

REM Agent 9 — Codex (port 3009)
start "Agent-9-Codex" cmd /k "%BUN% %DIST% --model cx@gpt-5.4 --port 3009"

REM Agent 10 — Codex (port 3010)
start "Agent-10-Codex" cmd /k "%BUN% %DIST% --model cx@gpt-5.4 --port 3010"

echo.
echo All agents started. Connect Claude Code to each agent:
echo   set ANTHROPIC_BASE_URL=http://localhost:3001   (Agent 1)
echo   set ANTHROPIC_BASE_URL=http://localhost:3006   (Agent 6 - Codex)
echo   claude
