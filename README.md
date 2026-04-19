# Claude Code Multi-Model Fleet

Run **Claude Code CLI** against multiple AI providers — Gemini (Google subscription), OpenAI Codex (ChatGPT Plus subscription), Kimi K2.5, and more — using your **existing subscriptions** instead of pay-per-token API keys.

This repo contains:
- A fully patched version of [Claudish v7.0.1](https://github.com/MadAppGang/claudish) with working multi-provider auth
- A self-applying patch script (`patch-claudish.js`) that upgrades a vanilla Claudish install
- A Windows wrapper (`claudish.cmd`) that bypasses Bun launcher bugs
- Complete documentation of every change and why it was made

---

## What Is This?

[Claude Code](https://claude.ai/code) is Anthropic's official CLI. It speaks the Anthropic Messages API. Claudish is a local proxy that translates those calls to other providers.

**The problem:** Claudish's OAuth flows for OpenAI Codex and Kimi are broken on Windows, and its Codex transport targets the wrong API endpoint for ChatGPT Plus subscription tokens.

**What we fixed:** Everything needed to run a real multi-provider agent fleet using existing subscriptions.

---

## Quick Start

```bash
# 1. Install Claudish
npm install -g claudish

# 2. Apply the patches (one command)
node patch-claudish.js

# 3. Copy the Windows wrapper
copy scripts\claudish.cmd %APPDATA%\npm\claudish.cmd

# 4. Log into your providers
claudish --gemini-login          # Google Gemini (subscription)
codex login                      # OpenAI Codex (ChatGPT Plus)

# 5. Start Claude Code pointing at Claudish
claude --model go@gemini-2.5-pro    # Gemini Pro
claude --model cx@gpt-5.4           # OpenAI Codex gpt-5.4
claude --model cx@gpt-5.4-mini      # OpenAI Codex mini
```

---

## Provider Reference

| Prefix | Provider | Auth | Notes |
|--------|----------|------|-------|
| `go@` | Google Gemini Code Assist | `claudish --gemini-login` | Free w/ Google One AI Premium |
| `cx@` | OpenAI Codex (ChatGPT Plus) | `codex login` | ChatGPT Plus/Pro subscription |
| `kc@` | Kimi Coding | `kimi login` | Kimi coding subscription |
| `kimi@` | Kimi Direct API | `MOONSHOT_API_KEY` env var | Moonshot API key |
| `oai@` | OpenAI Direct API | `OPENAI_API_KEY` env var | Standard OpenAI API key |
| `or@` | OpenRouter | `OPENROUTER_API_KEY` env var | OpenRouter gateway |
| `g@` | Google Gemini Direct | `GEMINI_API_KEY` env var | Google AI Studio key |

### Model Examples

```bash
# Gemini
claudish --model go@gemini-2.5-pro "task"
claudish --model go@gemini-2.5-flash "task"

# OpenAI Codex (ChatGPT Plus subscription)
claudish --model cx@gpt-5.4 "task"
claudish --model cx@gpt-5.4-mini "task"

# Kimi (requires active subscription)
claudish --model kc@kimi-for-coding "task"

# Auto-route by model name (no prefix needed)
claudish --model gpt-5.4 "task"
claudish --model gemini-2.5-pro "task"
```

---

## Multi-Agent Fleet Example

Run 10 parallel agents — 5 Gemini + 5 Codex — on different ports:

```bash
# Agent 1-5: Gemini
CLAUDISH_PORT=7381 claudish --model go@gemini-2.5-pro &
CLAUDISH_PORT=7382 claudish --model go@gemini-2.5-pro &
CLAUDISH_PORT=7383 claudish --model go@gemini-2.5-flash &
CLAUDISH_PORT=7384 claudish --model go@gemini-2.5-flash &
CLAUDISH_PORT=7385 claudish --model go@gemini-2.5-pro &

# Agent 6-10: Codex
CLAUDISH_PORT=7386 claudish --model cx@gpt-5.4 &
CLAUDISH_PORT=7387 claudish --model cx@gpt-5.4 &
CLAUDISH_PORT=7388 claudish --model cx@gpt-5.4-mini &
CLAUDISH_PORT=7389 claudish --model cx@gpt-5.4-mini &
CLAUDISH_PORT=7390 claudish --model cx@gpt-5.4 &
```

Then point separate `claude` instances at each port:
```bash
ANTHROPIC_BASE_URL=http://localhost:7381 claude "your task"
```

---

## Repository Structure

```
Claude-Code-Multi-Models/
├── README.md                   # This file
├── patch-claudish.js           # Self-applying patch script (run after npm install -g claudish)
├── scripts/
│   └── claudish.cmd            # Windows Bun launcher fix
├── patches/
│   ├── 01-windows-launcher.md  # Fix: Bun "which" → "where" on Windows
│   ├── 02-codex-auth-bridge.md # Fix: OpenAI Codex credential bridge
│   ├── 03-codex-endpoint.md    # Fix: chatgpt.com/backend-api endpoint routing
│   ├── 04-codex-payload.md     # Fix: Responses API payload requirements
│   └── 05-kimi-auth-bridge.md  # Fix: Kimi credential bridge + polling bug
└── docs/
    ├── architecture.md         # How the proxy works end-to-end
    ├── providers.md            # Deep-dive on each provider
    ├── troubleshooting.md      # Common errors and fixes
    └── session-log.md          # Full engineering session narrative
```

---

## Prerequisites

- [Claude Code CLI](https://claude.ai/code) (`npm install -g @anthropic-ai/claude-code`)
- [Claudish v7.0.1](https://github.com/MadAppGang/claudish) (`npm install -g claudish`)
- [Bun runtime](https://bun.sh) (`npm install -g bun` or PowerShell install)
- [OpenAI Codex CLI](https://github.com/openai/codex) (`npm install -g @openai/codex`) — for `codex login`
- A ChatGPT Plus/Pro subscription (for `cx@` models)
- A Google One AI Premium subscription (for `go@` models)

---

## License

MIT. Patches are modifications of Claudish (MIT licensed). Original Claudish by MadAppGang.
