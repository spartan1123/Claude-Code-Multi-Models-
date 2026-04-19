# Patch 05: Kimi OAuth Bridge and Polling Fix

**File:** `claudish@7.0.1@@@1/dist/index.js`  
**Classes modified:** `KimiOAuth`, `AnthropicCompatProviderTransport` (kimi-coding handler)

## Problem 1: Login Loop Bug

`claudish login kimi` starts the device authorization flow. The user approves in the browser. Claudish stays stuck at "Waiting for authorization..." and never saves the token.

### Root Cause

`KimiOAuth.pollForToken()` required BOTH `access_token` AND `refresh_token` to be present:

```js
// BEFORE (buggy):
if (result.access_token && result.refresh_token) {
  log("[KimiOAuth] Token received successfully");
  return result;
}
throw new Error("Invalid token response (missing access_token or refresh_token)");
```

If Kimi's token server returns a response with `access_token` but no `refresh_token` field (or with it under a different name), this immediately throws. The throw propagates out of the polling loop and leaves the login UI stuck.

### Fix

Make `refresh_token` optional:

```js
// AFTER (fixed):
if (result.access_token) {
  if (!result.refresh_token) {
    log("[KimiOAuth] Warning: token response missing refresh_token, using empty string");
    result.refresh_token = "";
  }
  log("[KimiOAuth] Token received successfully");
  return result;
}
throw new Error("Invalid token response (missing access_token)");
```

---

## Problem 2: No Bridge to Kimi CLI Credentials

Even with the polling fix, the token may already be stale or the user may prefer to authenticate via the official Kimi CLI. Claudish only read from `~/.claudish/kimi-oauth.json` and never looked for Kimi CLI credentials.

### How Kimi CLI Stores Credentials

File: `~/.kimi/credentials/kimi-code.json`
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_at": 1772248958.858235,
  "scope": "kimi-code",
  "token_type": "Bearer"
}
```

The JWT `client_id` in the token is `17e5f671-d194-4dfb-9706-5516cb48c098` — the same as Claudish's `OAUTH_CONFIG3.clientId`. They use the same OAuth application.

### Fix: Bridge in `kimi-coding` Transport

Modified `AnthropicCompatProviderTransport.getHeaders()` for the `kimi-coding` provider:

```js
if (this.provider.name === "kimi-coding" && !this.apiKey) {
  try {
    const credPath = join19(homedir18(), ".claudish", "kimi-oauth.json");
    const kimiCliPath = join19(homedir18(), ".kimi", "credentials", "kimi-code.json");
    let accessToken = null;

    if (existsSync17(credPath)) {
      // Primary: use Claudish's own OAuth token (with auto-refresh via KimiOAuth)
      const data = JSON.parse(readFileSync14(credPath, "utf-8"));
      if (data.access_token) {
        const oauth = KimiOAuth.getInstance();
        accessToken = await oauth.getAccessToken();
        log("[Kimi Coding] Using OAuth token from kimi-oauth.json");
      }
    } else if (existsSync17(kimiCliPath)) {
      // Fallback: bridge from Kimi CLI credentials
      const data = JSON.parse(readFileSync14(kimiCliPath, "utf-8"));
      if (data.access_token) {
        const now = Date.now();
        const expiresAt = data.expires_at ? data.expires_at * 1000 : 0;
        if (expiresAt > now + 60000) {
          accessToken = data.access_token;
          log("[Kimi Coding] Using credentials from ~/.kimi/credentials/kimi-code.json");
        } else {
          log("[Kimi Coding] ~/.kimi/credentials/kimi-code.json token expired — run: kimi login");
        }
      }
    }

    if (accessToken) {
      delete headers["x-api-key"];
      headers["Authorization"] = `Bearer ${accessToken}`;
      const platformHeaders = KimiOAuth.getInstance().getPlatformHeaders();
      Object.assign(headers, platformHeaders);
    }
  } catch (e) {
    log(`[${this.displayName}] OAuth fallback failed: ${e.message}`);
  }
}
```

### Platform Headers

The Kimi API requires identifying headers from `KimiOAuth.getPlatformHeaders()`:
```js
{
  "X-Msh-Platform": "claudish",
  "X-Msh-Version": "<version>",
  "X-Msh-Device-Name": "<hostname>",
  "X-Msh-Device-Model": "<platform>-<arch>",
  "X-Msh-Os-Version": "<os-release>",
  "X-Msh-Device-Id": "<uuid>"
}
```

---

## Kimi Provider Configuration

```
Provider:  kimi-coding
Prefix:    kc@
Endpoint:  https://api.kimi.com/coding/v1/messages
Format:    Anthropic-compatible (messages API)
Model:     kimi-for-coding (subscription model name)
Auth:      Bearer token from ~/.claudish/kimi-oauth.json or ~/.kimi/credentials/kimi-code.json
```

Direct API (Moonshot API key, no subscription needed):
```
Provider:  kimi
Prefix:    kimi@
Endpoint:  https://api.moonshot.ai/anthropic/v1/messages
Format:    Anthropic-compatible
Models:    kimi-k2.5, kimi-k2, moonshot-v1-8k, etc.
Auth:      MOONSHOT_API_KEY env var
```

---

## Usage After Patch

```bash
# Authenticate via Kimi CLI (recommended)
kimi login
claudish --model kc@kimi-for-coding "write a function to sort an array"

# Or use Claudish's own OAuth (now with polling bug fixed)
claudish login kimi
claudish --model kc@kimi-for-coding "write a function to sort an array"

# Direct API (requires Moonshot API key)
export MOONSHOT_API_KEY="sk-your-key-here"
claudish --model kimi@kimi-k2.5 "write a function to sort an array"
```

> **Note:** Testing confirmed auth works correctly (200 OK from login), but subscription was expired (402 Payment Required) at time of testing. Kimi K2.5 will work once subscription is renewed.
