# Claude Code Multi-Model Fleet

> **For AI agents setting this up:** Read the [Agent Setup Instructions](#agent-setup-instructions) section first. It contains everything you need to install and configure this on any machine, for any user, at any path.

Run **Claude Code CLI** against multiple AI providers — Gemini (Google subscription), OpenAI Codex (ChatGPT Plus), Kimi K2.5, and more — using **existing subscriptions** instead of pay-per-token API keys.

This repo contains:
- `claudish-dist.js` — Fully patched Claudish v7.0.1 engine (all fixes applied, ready to run)
- `patch-claudish.js` — Re-applies all patches if Claudish updates
- `scripts/claudish.cmd` — Windows global launcher
- `docs/` + `patches/` — Full technical documentation of every change

---

## Agent Setup Instructions

**This section is written for AI agents.** A user has pointed you at this repo and asked you to set it up. Follow these steps exactly. Every path is determined at runtime — do not hardcode the user's username or assume a specific folder location.

### Step 1 — Confirm prerequisites

Run each of these and verify they succeed:

```bash
node --version        # Need Node.js
bun --version         # Need Bun runtime
npm list -g claudish  # Should NOT be installed yet (or is ok if already installed)
```

If Bun is missing, install it:
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

If Node.js is missing, install from https://nodejs.org.

### Step 2 — Install Claudish globally

```bash
npm install -g claudish
```

### Step 3 — Find this repo's actual path

The repo could be anywhere. Determine its absolute path:

```bash
# The location of this README is the repo root. From an agent's perspective:
# - Read the path you used to open this file
# - That directory IS the value you will use as CLAUDISH_HOME
```

Example: if this README is at `C:\Users\alice\Projects\Ceil\Claude-Code-Multi-Models\README.md`,
then `CLAUDISH_HOME=C:\Users\alice\Projects\Ceil\Claude-Code-Multi-Models`

### Step 4 — Install the Windows launcher

Copy `scripts\claudish.cmd` to the npm global bin folder, then set `CLAUDISH_HOME` to this repo:

```powershell
# Replace <REPO_PATH> with the actual absolute path to this folder
copy "<REPO_PATH>\scripts\claudish.cmd" "$env:APPDATA\npm\claudish.cmd"
setx CLAUDISH_HOME "<REPO_PATH>"
```

After `setx`, open a new terminal for the env var to take effect.

**What the launcher does:** It calls `bun.exe` directly (bypassing a broken Node.js launcher in vanilla Claudish) and points it at `claudish-dist.js` in this repo. `CLAUDISH_HOME` tells it where the repo is, so the folder can be moved without breaking anything — just update the env var.

### Step 5 — Log into providers

Credentials are stored in the user's home directory by each provider's own CLI. They are **not** in this repo and cannot be moved.

```bash
# Google Gemini (requires Google One AI Premium subscription)
claudish --gemini-login
# Opens browser → approve → saves to ~/.claudish/gemini-oauth.json

# OpenAI Codex (requires ChatGPT Plus or Pro subscription)
npm install -g @openai/codex
codex login
# Opens browser → approve → saves to ~/.codex/auth.json

# Kimi K2.5 (requires active Kimi coding subscription)
npm install -g kimi-cli
kimi login
# Opens browser → approve → saves to ~/.kimi/credentials/kimi-code.json
```

You only need the providers the user has subscriptions for. Each is independent.

### Step 6 — Verify it works

```bash
# Test Gemini
claudish --model go@gemini-2.5-pro "say hello"

# Test Codex
claudish --model cx@gpt-5.4 "say hello"
```

Expected: a short text response streamed back in the terminal.

### Step 7 — Use with Claude Code CLI

Start Claudish on a port, then point Claude Code at it:

```bash
# Terminal 1: start the proxy
claudish --model go@gemini-2.5-pro --port 3001

# Terminal 2: run Claude Code through it
set ANTHROPIC_BASE_URL=http://localhost:3001
claude
```

Or use the included fleet launcher for 10 parallel agents:
```bash
launch-agents.cmd
```

### Troubleshooting for agents

| Symptom | Cause | Fix |
|---------|-------|-----|
| `claudish` not found after copy | New terminal needed | Open new terminal after `setx` |
| `bun: command not found` | Bun not installed | Run the Bun install script above |
| `401 Missing bearer` on Codex | `codex login` not done | Run `codex login` |
| `401 Missing scopes` on Codex | Wrong endpoint (old code) | Verify `claudish-dist.js` is the one from this repo, not vanilla Claudish |
| `402 Payment Required` on Kimi | Subscription expired | User needs to renew at kimi.com |
| Gemini `401` | Token expired | Run `claudish --gemini-login` again |
| Terminal window flashes | Windows Task Scheduler running old cron | Check Task Scheduler, disable any `claudish`-related tasks |

Full error reference: [docs/troubleshooting.md](docs/troubleshooting.md)

---

## Provider Quick Reference

| Prefix | Provider | How to auth | Subscription needed |
|--------|----------|-------------|---------------------|
| `go@` | Google Gemini Code Assist | `claudish --gemini-login` | Google One AI Premium |
| `cx@` | OpenAI Codex via ChatGPT | `codex login` | ChatGPT Plus or Pro |
| `kc@` | Kimi Coding | `kimi login` | Kimi coding plan |
| `kimi@` | Kimi Direct API | `MOONSHOT_API_KEY` env var | None (pay-per-token) |
| `oai@` | OpenAI Direct API | `OPENAI_API_KEY` env var | None (pay-per-token) |
| `or@` | OpenRouter | `OPENROUTER_API_KEY` env var | None (pay-per-token) |

### Available models

```bash
claudish --model go@gemini-2.5-pro       # Best quality Gemini
claudish --model go@gemini-2.5-flash     # Fastest Gemini
claudish --model cx@gpt-5.4              # Latest Codex flagship
claudish --model cx@gpt-5.4-mini         # Faster/lighter Codex
claudish --model kc@kimi-for-coding      # Kimi subscription model
claudish --model kimi@kimi-k2.5          # Kimi direct API
```

---

## Multi-Agent Fleet

Run 10 parallel agents for different departments/tasks:

```bash
# 5 Gemini agents (ports 3001-3005)
CLAUDISH_PORT=3001 claudish --model go@gemini-2.5-pro &
CLAUDISH_PORT=3002 claudish --model go@gemini-2.5-pro &
CLAUDISH_PORT=3003 claudish --model go@gemini-2.5-flash &
CLAUDISH_PORT=3004 claudish --model go@gemini-2.5-flash &
CLAUDISH_PORT=3005 claudish --model go@gemini-2.5-pro &

# 5 Codex agents (ports 3006-3010)
CLAUDISH_PORT=3006 claudish --model cx@gpt-5.4 &
CLAUDISH_PORT=3007 claudish --model cx@gpt-5.4 &
CLAUDISH_PORT=3008 claudish --model cx@gpt-5.4-mini &
CLAUDISH_PORT=3009 claudish --model cx@gpt-5.4-mini &
CLAUDISH_PORT=3010 claudish --model cx@gpt-5.4 &
```

Connect Claude Code to any agent:
```bash
ANTHROPIC_BASE_URL=http://localhost:3001 claude "your task"
```

Or double-click `launch-agents.cmd` in this folder to start all 10 at once.

---

## Repository Structure

```
Claude-Code-Multi-Models/
├── README.md              # This file — agent setup instructions + reference
├── claudish-dist.js       # Patched Claudish v7.0.1 engine (run this, not vanilla)
├── patch-claudish.js      # Re-apply patches after a Claudish version update
├── start-claudish.cmd     # Single-agent launcher (local, no global install needed)
├── launch-agents.cmd      # 10-agent fleet launcher (Windows)
├── scripts/
│   └── claudish.cmd       # Global launcher — copy to %APPDATA%\npm\claudish.cmd
├── patches/
│   ├── 01-windows-launcher.md
│   ├── 02-codex-auth-bridge.md
│   ├── 03-codex-endpoint.md
│   ├── 04-codex-payload.md
│   └── 05-kimi-auth-bridge.md
└── docs/
    ├── architecture.md
    ├── providers.md
    ├── troubleshooting.md
    └── session-log.md
```

---

## How It Works

Claude Code speaks only the Anthropic Messages API. Claudish is a local HTTP proxy that:
1. Receives requests from Claude Code at `localhost:<port>`
2. Translates them to the target provider's format (Gemini SSE, OpenAI Responses API, etc.)
3. Translates the streaming response back to Anthropic SSE format
4. Returns it to Claude Code as if it came from Anthropic

All provider auth, endpoint routing, and format conversion happens inside `claudish-dist.js`.

Full architecture: [docs/architecture.md](docs/architecture.md)

---

## Prerequisites

- [Node.js](https://nodejs.org) (for `npm install`)
- [Bun runtime](https://bun.sh) (the JS runtime Claudish uses)
- [Claude Code CLI](https://claude.ai/code): `npm install -g @anthropic-ai/claude-code`
- Claudish: `npm install -g claudish`
- Per-provider CLI for auth (only install what you need):
  - Codex: `npm install -g @openai/codex`
  - Kimi: `npm install -g kimi-cli`

---

## License

MIT. Patches modify Claudish (MIT licensed by MadAppGang).
