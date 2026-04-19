# Troubleshooting Guide

## Error: "Missing bearer or basic authentication in header" (HTTP 401)

**Provider:** OpenAI Codex (`cx@`)  
**Cause:** The credential bridge to `~/.codex/auth.json` is not finding a valid token.

**Check:**
```bash
# Does the file exist?
ls ~/.codex/auth.json

# Is auth_mode correct?
python3 -c "import json; d=json.load(open('~/.codex/auth.json' if __import__('os').name!='nt' else 'C:/Users/%s/.codex/auth.json' % __import__('os').environ['USERNAME'])); print(d.get('auth_mode'), bool(d.get('tokens',{}).get('access_token')))"
```

**Fix:** Run `codex login` to authenticate with the official Codex CLI. This will populate `~/.codex/auth.json` with `auth_mode: "chatgpt"`.

---

## Error: "Missing scopes: api.responses.write" (HTTP 401)

**Provider:** OpenAI Codex (`cx@`)  
**Cause:** The patch is not applied, or the old Claudish code is still routing to `api.openai.com/v1/responses` with a ChatGPT Plus subscription token. ChatGPT Plus tokens work on `chatgpt.com/backend-api/codex/responses`, not the standard API.

**Fix:** Re-apply the patch:
```bash
node patch-claudish.js
```

---

## Error: "Store must be set to false" (HTTP 400)

**Provider:** OpenAI Codex via ChatGPT backend  
**Cause:** The `store` field is missing from the request payload. Patch not applied.

**Fix:** Re-apply the patch. The `CodexAPIFormat.buildPayload()` fix adds `store: false` automatically.

---

## Error: "Unsupported parameter: max_output_tokens" (HTTP 400)

**Provider:** OpenAI Codex via ChatGPT backend  
**Cause:** The `transformPayload()` override is missing. Patch not applied.

**Fix:** Re-apply the patch.

---

## Error: "Instructions are required" (HTTP 400)

**Provider:** OpenAI Codex via ChatGPT backend  
**Cause:** No `instructions` field in the request. Happens when there's no system prompt and the patch didn't add the default.

**Fix:** Re-apply the patch. The fix adds `payload.instructions = claudeRequest.system || "You are a helpful assistant."`.

---

## Error: Claudish stuck "Waiting for authorization..." (Kimi login)

**Cause:** The `pollForToken()` function throws if the token response is missing `refresh_token`, which some versions of the Kimi auth server return.

**Fix:** Apply patch 05 (Kimi auth bridge). Or use the Kimi CLI directly:
```bash
kimi login
```
Then use `claudish --model kc@kimi-for-coding`. The bridge reads `~/.kimi/credentials/kimi-code.json` automatically.

---

## Error: Kimi 402 Payment Required

**Cause:** Your Kimi subscription has expired.  
**Fix:** Renew at kimi.com, then run `kimi login` to refresh credentials.

---

## Error: Claudish command not found / crashes immediately on Windows

**Cause:** The Bun launcher (`claudish.cjs`) uses Unix `which` command which doesn't exist on Windows.

**Fix:** Replace `%APPDATA%\npm\claudish.cmd` with the direct Bun wrapper:
```cmd
@echo off
"C:\Users\<YOU>\.bun\bin\bun.exe" "C:\Users\<YOU>\.bun\install\cache\claudish@7.0.1@@@1\dist\index.js" %*
```
Or copy `scripts\claudish.cmd` from this repo (adjust paths for your username).

---

## Error: Token expired for any provider

**Gemini:**
```bash
claudish --gemini-login
```

**Codex:**
```bash
codex login
```

**Kimi:**
```bash
kimi login
```

Token lifetimes:
- Gemini: ~1 hour, auto-refreshes
- Codex: ~24 hours (JWT exp ~14000 minutes observed)
- Kimi: ~2-3 hours (from `expires_at` field in credentials file)

---

## Error: Multiple agents conflict on the same port

**Cause:** Default Claudish port is 7380. Multiple instances need different ports.

**Fix:**
```bash
CLAUDISH_PORT=7381 claudish --model go@gemini-2.5-pro "task" &
CLAUDISH_PORT=7382 claudish --model cx@gpt-5.4 "task" &
```

---

## Checking Which Version of Patches Is Active

```bash
# Check if the Codex endpoint override is in place
grep -c "chatgpt.com/backend-api/codex/responses" \
  ~/.bun/install/cache/claudish@7.0.1@@@1/dist/index.js
# Should output: 1

# Check if the Kimi bridge is in place  
grep -c "kimi-code.json" \
  ~/.bun/install/cache/claudish@7.0.1@@@1/dist/index.js
# Should output: 1
```

---

## Debug Logs

Claudish writes session logs to `~/.claudish/logs/`. Each session gets a timestamped file.

```bash
# View latest log
cat $(ls -t ~/.claudish/logs/ | head -1 | xargs -I{} echo ~/.claudish/logs/{})

# Watch live
tail -f ~/.claudish/logs/claudish_<timestamp>.log
```

Key log messages to look for:
- `[OpenAI Codex] Constructor: detected ChatGPT token, using chatgpt.com backend` — bridge active
- `[OpenAI Codex] Using credentials from ~/.codex/auth.json via chatgpt.com backend` — auth working
- `[Openai-codex] Response status: 200` — request succeeded
- `[Openai-codex] Response status: 401` — auth failed, check credentials
- `[Kimi Coding] Using credentials from ~/.kimi/credentials/kimi-code.json` — Kimi bridge active
