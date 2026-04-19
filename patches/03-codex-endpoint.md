# Patch 03: OpenAI Codex Endpoint Routing

**File:** `claudish@7.0.1@@@1/dist/index.js`  
**Class modified:** `OpenAICodexTransport`

## Problem

Claudish originally routes all `cx@` requests to `https://api.openai.com/v1/responses`. This is the standard OpenAI Responses API, which requires an API key with the `api.responses.write` scope. ChatGPT Plus subscription tokens do NOT have this scope — they're session tokens for ChatGPT features, not API keys.

Error received: `HTTP 401 — Missing scopes: api.responses.write`

## Discovery

Compared Claudish's endpoint with OpenClaw's (a similar multi-model proxy):

**OpenClaw `openai-codex-provider-B8q_A60M.js`:**
```js
const OPENAI_CODEX_BASE_URL = "https://chatgpt.com/backend-api";
// ...
const baseUrl = api === "openai-codex-responses" ? OPENAI_CODEX_BASE_URL : model.baseUrl;
```

OpenClaw routes to `chatgpt.com/backend-api`, not `api.openai.com`. This is the ChatGPT internal API that accepts subscription tokens.

## Endpoint Discovery via curl

Tested `chatgpt.com/backend-api` paths with the ChatGPT Plus token:

```
/responses              → 404 Not Found
/v1/responses           → 404 Not Found
/codex/responses        → 400 (path exists, wrong params)
/conversation           → 422 (path exists, wrong format)
```

Iterating on `/codex/responses`:
```bash
# Missing instructions
{"detail":"Instructions are required"}

# Missing store:false
{"detail":"Store must be set to false"}

# Missing stream:true  
{"detail":"Stream must be set to true"}

# SUCCESS
POST https://chatgpt.com/backend-api/codex/responses
{
  "model": "gpt-5.4",
  "instructions": "You are a helpful assistant.",
  "input": [{"role":"user","content":"hello"}],
  "stream": true,
  "store": false
}
→ HTTP 200, SSE stream
```

Response headers confirmed subscription info:
```
x-codex-active-limit: premium
x-codex-plan-type: plus
x-codex-primary-used-percent: 2
```

## The Fix

Added `_useChatGPTBackend` flag to `OpenAICodexTransport` and overrode `getEndpoint()`:

```js
OpenAICodexTransport = class OpenAICodexTransport extends OpenAIProviderTransport {
  _useChatGPTBackend = false;

  constructor(provider, modelName, apiKey) {
    super(provider, modelName, apiKey);
    this.streamFormat = "openai-responses-sse";
    // Eagerly detect ChatGPT token (sync) so getEndpoint() is correct on first call
    // IMPORTANT: getEndpoint() is called BEFORE getHeaders() in ComposedHandler
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

  getEndpoint() {
    if (this._useChatGPTBackend) {
      return "https://chatgpt.com/backend-api/codex/responses";
    }
    return `${this.provider.baseUrl}/v1/responses`;  // api.openai.com (for API keys)
  }
};
```

## Why Eager Detection in Constructor

`ComposedHandler.handleRequest()` calls:
```js
const endpoint = this.provider.getEndpoint();   // line 33044 — FIRST
const headers = await this.provider.getHeaders(); // line 33045 — SECOND
```

If we only set `_useChatGPTBackend` inside the async `getHeaders()` flow, the first request would use the wrong endpoint. By detecting synchronously in the constructor, `getEndpoint()` is already correct before any request starts.

## Backend Decision Logic

| Condition | Endpoint Used |
|-----------|--------------|
| `~/.claudish/codex-oauth.json` exists with valid tokens | `api.openai.com/v1/responses` |
| `~/.codex/auth.json` exists with `auth_mode: "chatgpt"` | `chatgpt.com/backend-api/codex/responses` |
| `OPENAI_CODEX_API_KEY` env var set | `api.openai.com/v1/responses` |
