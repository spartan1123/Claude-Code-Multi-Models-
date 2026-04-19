# Provider Deep-Dive

## Google Gemini Code Assist (`go@`)

**Subscription:** Google One AI Premium or Google Workspace with Gemini  
**Auth flow:** Browser OAuth → `~/.claudish/gemini-oauth.json`  
**Endpoint:** `https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse`  
**Transport:** Custom Gemini SSE format

### Setup
```bash
claudish --gemini-login
# Opens browser → approve → credentials saved
claudish --model go@gemini-2.5-pro "task"
```

### Available Models
```bash
claudish --model go@gemini-2.5-pro       # Best quality
claudish --model go@gemini-2.5-flash     # Fastest
claudish --model go@gemini-2.5-flash-8b  # Lightest
claudish --model go@gemini-2.0-flash     # Previous gen
```

### Notes
- Token auto-refreshes (~1 hour expiry, refresh_token used automatically)
- Has fallback chain: if primary model is capacity-exhausted, tries alternatives
- Supports all Claude Code features including tool use

---

## OpenAI Codex / ChatGPT Plus (`cx@`)

**Subscription:** ChatGPT Plus or Pro  
**Auth flow:** `codex login` → `~/.codex/auth.json`  
**Endpoint:** `https://chatgpt.com/backend-api/codex/responses` (with ChatGPT Plus token)  
            OR `https://api.openai.com/v1/responses` (with API key)  
**Transport:** OpenAI Responses API SSE format

### Setup
```bash
# Method 1: Use Codex CLI (recommended — stable OAuth)
npm install -g @openai/codex
codex login
claudish --model cx@gpt-5.4 "task"

# Method 2: API key (no subscription needed, pay-per-token)
export OPENAI_CODEX_API_KEY="sk-your-key"
claudish --model cx@gpt-5.4 "task"
```

### Available Models (ChatGPT Plus)
```bash
claudish --model cx@gpt-5.4        # Latest flagship Codex model
claudish --model cx@gpt-5.4-mini   # Faster, lighter variant
```

### Quota Headers (visible in debug logs)
```
x-codex-active-limit: premium
x-codex-plan-type: plus
x-codex-primary-used-percent: 2       # % of 5-hour window used
x-codex-secondary-used-percent: 0     # % of weekly window used
x-codex-primary-window-minutes: 300   # 5-hour rolling window
x-codex-secondary-window-minutes: 10080  # 1-week rolling window
```

### How the ChatGPT Token Works
The token from `~/.codex/auth.json` is a **ChatGPT user session JWT**:
- Audience (`aud`): `https://api.openai.com/v1`
- Issuer (`iss`): `https://auth.openai.com`  
- Contains: `chatgpt_account_id`, `chatgpt_plan_type`, `chatgpt_user_id`
- **Does NOT have** `api.responses.write` scope (would be needed for standard API)
- Works via subscription path at `chatgpt.com/backend-api/codex/responses`

---

## Kimi Coding / Kimi K2.5 (`kc@`)

**Subscription:** Kimi Coding Plan (kimi.com)  
**Auth flow:** `kimi login` → `~/.kimi/credentials/kimi-code.json`  
**Endpoint:** `https://api.kimi.com/coding/v1/messages`  
**Transport:** Anthropic-compatible messages API

### Setup
```bash
npm install -g kimi-cli  # or use kimi desktop app
kimi login
claudish --model kc@kimi-for-coding "task"
```

### Direct API (No subscription)
```bash
export MOONSHOT_API_KEY="sk-your-moonshot-key"
claudish --model kimi@kimi-k2.5 "task"
claudish --model kimi@kimi-k2 "task"
```

### Available Models (Moonshot Direct API)
```
kimi-k2.5              — Latest K2.5, 262K context
kimi-k2                — K2, 131K context
moonshot-v1-8k         — 8K context
moonshot-v1-32k        — 32K context
moonshot-v1-128k       — 128K context
kimi-k2-thinking-turbo — Reasoning model
```

---

## OpenAI Direct API (`oai@`)

**Auth:** `OPENAI_API_KEY` environment variable  
**Endpoint:** `https://api.openai.com/v1/chat/completions`  
**Transport:** OpenAI Chat Completions SSE

```bash
export OPENAI_API_KEY="sk-your-key"
claudish --model oai@gpt-4o "task"
claudish --model oai@o3 "task"
```

---

## OpenRouter (`or@`)

**Auth:** `OPENROUTER_API_KEY` environment variable  
**Endpoint:** `https://openrouter.ai/api/v1/chat/completions`  
**Access:** 200+ models from any provider

```bash
export OPENROUTER_API_KEY="sk-or-your-key"
claudish --model or@anthropic/claude-opus-4-5 "task"
claudish --model or@meta-llama/llama-3.1-405b "task"
claudish --model or@x-ai/grok-3 "task"
```

---

## Kimi Direct / Moonshot (`kimi@`, `moon@`)

**Auth:** `MOONSHOT_API_KEY` environment variable  
**Endpoint:** `https://api.moonshot.ai/anthropic/v1/messages`  
**Format:** Anthropic-compatible

```bash
export MOONSHOT_API_KEY="sk-your-key"
claudish --model kimi@kimi-k2.5 "task"
claudish --model moon@moonshot-v1-128k "task"
```
