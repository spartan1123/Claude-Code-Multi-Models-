# Patch 02: OpenAI Codex Credential Bridge

**File:** `claudish@7.0.1@@@1/dist/index.js`  
**Classes modified:** `CodexOAuth`, `OpenAICodexTransport`

## Problem

Claudish's built-in `claudish login codex` OAuth flow fails on Windows. Users who have already authenticated via `codex login` (the official OpenAI Codex CLI) have valid credentials in `~/.codex/auth.json`, but Claudish never looks there.

## How the Codex CLI Stores Credentials

File: `~/.codex/auth.json`
```json
{
  "auth_mode": "chatgpt",
  "OPENAI_API_KEY": null,
  "tokens": {
    "id_token": "eyJ...",
    "access_token": "eyJ...",
    "refresh_token": "rt_...",
    "account_id": "37f34b7d-2df5-4b75-949c-ff9ffe19ca7f"
  },
  "last_refresh": "2026-04-18T23:55:11Z"
}
```

The JWT `access_token` has:
- `aud: "https://api.openai.com/v1"` — targeted at the OpenAI API
- `iss: "https://auth.openai.com"` — issued by OpenAI auth server
- `chatgpt_account_id` — the account UUID needed for the `ChatGPT-Account-ID` header
- `chatgpt_plan_type: "plus"` — identifies ChatGPT Plus subscription

## Changes to `CodexOAuth`

Added `loadFromCodexCli()` method and modified `loadCredentials()` to try it first:

```js
// NEW method added to CodexOAuth class
loadFromCodexCli() {
  try {
    const codexAuthPath = join16(homedir15(), ".codex", "auth.json");
    if (!existsSync14(codexAuthPath)) return null;
    const raw = readFileSync11(codexAuthPath, "utf-8");
    const authFile = JSON.parse(raw);
    if (!authFile || authFile.auth_mode !== "chatgpt") return null;
    const tokens = authFile.tokens;
    if (!tokens || !tokens.access_token || !tokens.refresh_token) return null;
    let expires_at = Date.now() + 60 * 60 * 1000;
    try {
      const payload = JSON.parse(
        Buffer.from(tokens.access_token.split(".")[1], "base64url").toString("utf-8")
      );
      if (payload.exp) expires_at = payload.exp * 1000;
    } catch {}
    log("[CodexOAuth] Loaded credentials from ~/.codex/auth.json");
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at,
      account_id: tokens.account_id
    };
  } catch (e) {
    log(`[CodexOAuth] Failed to load from Codex CLI: ${e.message}`);
    return null;
  }
}

// MODIFIED: loadCredentials() now tries Codex CLI first
loadCredentials() {
  const codexCliCreds = this.loadFromCodexCli();
  if (codexCliCreds) return codexCliCreds;
  // ... rest of existing logic reading codex-oauth.json
}
```

## Changes to `OpenAICodexTransport.tryOAuthHeaders()`

Added fallback to read `~/.codex/auth.json` when `~/.claudish/codex-oauth.json` doesn't exist:

```js
async tryOAuthHeaders() {
  const credPath = join17(homedir16(), ".claudish", "codex-oauth.json");
  if (existsSync15(credPath)) {
    // ... existing logic (unchanged)
  }
  // NEW: Fallback to Codex CLI credentials
  try {
    const codexPath = join17(homedir16(), ".codex", "auth.json");
    if (!existsSync15(codexPath)) return null;
    const authFile = JSON.parse(readFileSync12(codexPath, "utf-8"));
    if (!authFile || authFile.auth_mode !== "chatgpt") return null;
    const tokens = authFile.tokens;
    if (!tokens || !tokens.access_token) return null;
    log("[OpenAI Codex] Using credentials from ~/.codex/auth.json via chatgpt.com backend");
    this._useChatGPTBackend = true;  // ← signals endpoint override
    return buildOAuthHeaders(tokens.access_token, tokens.account_id);
  } catch (e) {
    log(`[OpenAI Codex] ~/.codex/auth.json read failed: ${e}`);
    return null;
  }
}
```

## Auth Header Format

```js
function buildOAuthHeaders(token, accountId) {
  const headers = { Authorization: `Bearer ${token}` };
  if (accountId) {
    headers["ChatGPT-Account-ID"] = accountId;
  }
  return headers;
}
```

The `ChatGPT-Account-ID` header is required by the ChatGPT backend. Its value is the UUID from `tokens.account_id` in `auth.json`.
