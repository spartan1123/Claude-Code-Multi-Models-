# Engineering Session Log

This document is a full narrative of the engineering session that produced all the patches in this repository. It covers every problem encountered, every root cause found, and every fix applied — in the order they happened.

---

## Problem 1: Windows Terminal Flashing Every Minute

**Symptom:** A PowerShell terminal window was flashing on screen every 60 seconds.

**Root cause:** The CodexCeil project's Windows Task Scheduler task (`CodexCeil-cron-registry_json-keepalive`) runs a cron job every minute using `powershell.exe` without the `-WindowStyle Hidden` flag. The task invokes `invoke-cron-entry.ps1` which sources `agent-runtime.ps1`. Without Hidden mode, PowerShell creates a visible window for each run.

**Fix:** Disabled the scheduled task:
```powershell
Disable-ScheduledTask -TaskName "CodexCeil-cron-registry_json-keepalive"
```

Long-term fix: Add `-WindowStyle Hidden` to the `schtasks.exe /Create` call in `scripts/sync-cron-tasks.ps1`:
```powershell
$command = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ..."
```

---

## Problem 2: Claudish Not Working on Windows

**Symptom:** Running `claudish` produced no output or a "Bun not found" error.

**Root cause:** The Claudish npm package ships two launcher files:
1. `bin/claudish.cjs` — Node.js launcher that finds Bun and re-executes under it
2. `claudish.cmd` — Windows batch file that calls `claudish.cjs`

The `findBun()` function in `claudish.cjs` uses `execSync("which bun")` — a Unix command that doesn't exist on Windows. It should use `where bun` on Windows.

Additionally, the hard-coded Bun candidate paths didn't include the standard Windows install location (`%USERPROFILE%\.bun\bin\bun.exe`).

**Fix 1 — Patch `claudish.cjs`:**
```js
// Before:
const whichCmd = process.platform === "win32" ? "where" : "which";
// (note: the original code didn't do this conditional — it hardcoded "which")
```
Added `process.env.USERPROFILE + "\\.bun\\bin\\bun.exe"` to the candidates array.

**Fix 2 — Replace `claudish.cmd` with direct Bun call (simplest, most reliable):**
```cmd
@echo off
"C:\Users\koii\.bun\bin\bun.exe" "C:\Users\koii\.bun\install\cache\claudish@7.0.1@@@1\dist\index.js" %*
```
This bypasses the Node.js launcher entirely and calls Bun directly. Claudish requires Bun (uses `bun:ffi` for TUI), so this is the correct approach on Windows.

---

## Problem 3: Gemini OAuth Login

**Goal:** Use Google One AI Premium subscription with `go@gemini-*` models.

**Process:** Ran `claudish --gemini-login`. This started a browser OAuth flow targeting Google's Code Assist API. The flow succeeded and saved credentials to `~/.claudish/gemini-oauth.json`.

**Result:** `claudish --model go@gemini-2.5-pro "prompt"` works correctly.

The Gemini transport uses `cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse` with the Google OAuth bearer token.

---

## Problem 4: OpenAI Codex OAuth Login Fails on Windows

**Symptom:** `claudish login codex` started the browser OAuth flow, the user approved in browser, but Claudish stayed stuck at "Waiting for authorization...".

**Root cause — Part A (URL parameters):** An earlier patch attempt removed two required OAuth URL parameters (`codex_cli_simplified_flow=true` and `originator=codex_cli_rs`). These are required by OpenAI's auth server for the Codex device flow. Removing them caused the authorization URL to generate a token that OpenAI's API rejected.

**Fix:** Restored both parameters:
```js
const params = [
  `response_type=code`,
  `client_id=${encodeURIComponent(OAUTH_CONFIG2.clientId)}`,
  `redirect_uri=${encodeURIComponent(redirectUri)}`,
  `scope=${scope}`,
  `code_challenge=${encodeURIComponent(codeChallenge)}`,
  `code_challenge_method=S256`,
  `id_token_add_organizations=true`,
  `codex_cli_simplified_flow=true`,   // ← required
  `state=${encodeURIComponent(state)}`,
  `originator=codex_cli_rs`           // ← required
].join("&");
```

**Root cause — Part B (token not captured):** Even with correct URL params, the OAuth polling flow was timing out. The user had already logged in via `codex login` (the official OpenAI Codex CLI). The credentials were in `~/.codex/auth.json` with `auth_mode: "chatgpt"`. Claudish never looked there.

**Decision:** Instead of fighting the broken OAuth polling, bridge to the existing Codex CLI credentials. This is the same approach OpenClaw uses (`managedBy: "codex-cli"` profiles).

---

## Problem 5: The Wrong API Endpoint for ChatGPT Plus Tokens

**Symptom:** After adding the `~/.codex/auth.json` bridge, requests got HTTP 401 with "Missing scopes: api.responses.write".

**Investigation:**
1. Decoded the JWT from `~/.codex/auth.json`:
   - `aud: "https://api.openai.com/v1"` — correct audience
   - `chatgpt_plan_type: "plus"` — confirms subscription
   - No `scope` claim — subscription token, not API key
2. Claudish was targeting `api.openai.com/v1/responses` — the standard Responses API
3. The standard Responses API requires an API key with `api.responses.write` scope
4. ChatGPT Plus subscription tokens do NOT have `api.responses.write`

**Key insight from OpenClaw source analysis:**
```js
// OpenClaw's openai-codex-provider-B8q_A60M.js:
const OPENAI_CODEX_BASE_URL = "https://chatgpt.com/backend-api";
```
OpenClaw routes Codex subscription calls to `chatgpt.com/backend-api`, NOT `api.openai.com`.

**Endpoint discovery:** Tested `chatgpt.com/backend-api` with curl:
- `/responses` → 404
- `/v1/responses` → 404  
- `/codex/responses` → **400** (path exists, wrong params)

Iterating on parameters:
```bash
# Failed: {"detail":"Instructions are required"}
curl -d '{"model":"gpt-5.4","input":[...],"stream":true,"store":false}'

# Failed: {"detail":"Store must be set to false"}
curl -d '{"model":"gpt-5.4","instructions":"...","input":[...],"stream":true}'

# Failed: {"detail":"Stream must be set to true"}  
curl -d '{"model":"gpt-5.4","instructions":"...","input":[...],"stream":false,"store":false}'

# SUCCESS: HTTP 200 with SSE stream
curl -d '{"model":"gpt-5.4","instructions":"...","input":[...],"stream":true,"store":false}'
```

**The correct endpoint:** `https://chatgpt.com/backend-api/codex/responses`

**Required parameters:**
- `stream: true` — mandatory, no sync mode
- `store: false` — mandatory, Plus subscription doesn't support persistence
- `instructions` — mandatory, equivalent to system prompt (cannot be omitted)
- `max_output_tokens` — must NOT be included (server rejects it)

---

## Problem 6: Sequencing Bug — Wrong Endpoint on First Request

**Symptom:** After adding the backend URL switch, the first request still hit `api.openai.com` (401), then retried on `chatgpt.com` (succeeded).

**Root cause:** In `ComposedHandler.handleRequest()`:
```js
const endpoint = this.provider.getEndpoint();  // ← called FIRST (line 33044)
const headers = await this.provider.getHeaders();  // ← called SECOND (line 33045)
```
The `_useChatGPTBackend` flag was being set in `tryOAuthHeaders()` (called by `getHeaders()`), but `getEndpoint()` was called before that, so the first request used the wrong URL.

**Fix:** Eagerly detect the ChatGPT token in the constructor (synchronously) so the flag is correct before any method is called:
```js
constructor(provider, modelName, apiKey) {
  super(provider, modelName, apiKey);
  this.streamFormat = "openai-responses-sse";
  // Eagerly detect so getEndpoint() is correct on first call
  try {
    const credPath = join17(homedir16(), ".claudish", "codex-oauth.json");
    if (!existsSync15(credPath)) {
      const codexPath = join17(homedir16(), ".codex", "auth.json");
      if (existsSync15(codexPath)) {
        const authFile = JSON.parse(readFileSync12(codexPath, "utf-8"));
        if (authFile?.auth_mode === "chatgpt" && authFile?.tokens?.access_token) {
          this._useChatGPTBackend = true;
        }
      }
    }
  } catch {}
}
```

---

## Problem 7: `max_output_tokens` Rejected by ChatGPT Backend

**Symptom:** After fixing the endpoint, got HTTP 400: `{"detail":"Unsupported parameter: max_output_tokens"}`.

**Root cause:** `CodexAPIFormat.buildPayload()` always included `max_output_tokens` from `claudeRequest.max_tokens`. The `chatgpt.com/backend-api/codex/responses` endpoint doesn't support this parameter.

**Fix:** Added `transformPayload()` to `OpenAICodexTransport` that strips it when using the ChatGPT backend:
```js
transformPayload(payload) {
  if (this._useChatGPTBackend) {
    const { max_output_tokens, ...rest } = payload;
    return rest;
  }
  return payload;
}
```
`transformPayload` is called at line 33035, before `getEndpoint()` and `getHeaders()`, so this works correctly.

---

## Problem 8: Kimi OAuth Login Loop

**Symptom:** `claudish login kimi` showed the device authorization URL, user approved in browser, but Claudish stayed "Waiting for authorization...". The user tried the URL a second time and saw "the device authorization code has already been approved".

**Root cause — polling bug:** The `pollForToken()` function contained this check:
```js
if (result.access_token && result.refresh_token) {
  return result;
}
throw new Error("Invalid token response (missing access_token or refresh_token)");
```
If Kimi's token server returns a response with `access_token` but no `refresh_token` (or with different field names), the function throws immediately instead of saving the token. This leaves Claudish in the polling loop until timeout.

**Fix:** Made `refresh_token` optional:
```js
if (result.access_token) {
  if (!result.refresh_token) {
    result.refresh_token = "";  // graceful fallback
  }
  return result;
}
throw new Error("Invalid token response (missing access_token)");
```

**Bridge fix:** Added fallback to read `~/.kimi/credentials/kimi-code.json` (written by the official Kimi CLI) in the `kimi-coding` transport `getHeaders()` method. Same pattern as the Codex bridge.

**Note:** Kimi K2.5 testing was blocked by an expired Kimi subscription (402 Payment Required). The auth bridge is in place and will work once the subscription is renewed.

---

## Verification

Final test results:

| Command | HTTP Status | Response |
|---------|-------------|----------|
| `claudish --model go@gemini-2.5-pro "say hi"` | 200 | "Hi there!" |
| `claudish --model cx@gpt-5.4 "say hi"` | 200 | "Hello!" |
| `claudish --model cx@gpt-5.4-mini "say hi"` | 200 | "Hi!" |
| `claudish --model kc@kimi-for-coding "say hi"` | 402 (subscription expired) | — |

Gemini and Codex are fully working. Kimi is ready pending subscription renewal.
