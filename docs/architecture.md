# Architecture: How Claude Code Multi-Model Works

## The Proxy Pattern

```
Claude Code CLI  →  Claudish (local proxy)  →  AI Provider
(Anthropic API)     (translates + routes)       (Gemini / OpenAI / Kimi)
```

Claude Code speaks only the Anthropic Messages API format. Claudish runs as an HTTP server on localhost (default port 7380), intercepts those calls, translates the request to the target provider's format, streams the response back translated into Anthropic SSE format.

Claude Code is pointed at Claudish by setting:
```
ANTHROPIC_BASE_URL=http://localhost:7380
ANTHROPIC_API_KEY=dummy-key
```
Or by running `claudish --model <name> "prompt"` directly (Claudish starts the proxy and launches Claude Code automatically).

---

## Request Flow (Detailed)

```
1. User runs:
   claudish --model cx@gpt-5.4 "write a function"

2. Claudish starts:
   - Spawns local HTTP proxy on random port
   - Resolves model: "cx@gpt-5.4" → provider=openai-codex, modelId=gpt-5.4
   - Creates handler: OpenAICodexTransport + CodexAPIFormat
   - Sets ANTHROPIC_BASE_URL=http://localhost:<port>
   - Launches claude CLI

3. Claude Code sends:
   POST http://localhost:<port>/v1/messages
   {
     "model": "claude-sonnet-4-5",  ← ignored by proxy
     "messages": [...],
     "system": "...",
     "max_tokens": 8192,
     "stream": true
   }

4. Claudish translates (CodexAPIFormat.buildPayload):
   POST https://chatgpt.com/backend-api/codex/responses
   {
     "model": "gpt-5.4",
     "input": [...],               ← converted from messages
     "instructions": "...",         ← from system prompt
     "stream": true,
     "store": false
   }
   Authorization: Bearer <ChatGPT-Plus-token>
   ChatGPT-Account-ID: <account-uuid>

5. Provider streams back SSE events:
   event: response.output_text.delta
   data: {"delta": "Hello", ...}

6. Claudish translates back (openai-responses-sse parser):
   data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

7. Claude Code receives valid Anthropic SSE and renders to user
```

---

## Component Map

### Transport Layer (`OpenAICodexTransport`)
Handles HTTP communication with the AI provider.
- `getEndpoint()` — returns the correct URL (chatgpt.com vs api.openai.com)
- `getHeaders()` → calls `tryOAuthHeaders()` to build auth headers
- `transformPayload()` — strips unsupported fields per backend
- `enqueueRequest()` — handles retries, rate limits, auth refresh

### Adapter Layer (`CodexAPIFormat`)
Translates between Anthropic message format and provider format.
- `buildPayload()` — Anthropic messages → Responses API input array
- `convertMessagesToResponsesAPI()` — message role/content mapping
- `getStreamFormat()` → `"openai-responses-sse"` — selects SSE parser

### Auth Layer (`CodexOAuth`, `KimiOAuth`)
Manages OAuth token storage, refresh, and credential bridging.
- `loadCredentials()` — reads from `~/.claudish/codex-oauth.json` OR `~/.codex/auth.json`
- `getAccessToken()` — returns valid token, refreshing if needed
- `loadFromCodexCli()` — bridges Codex CLI credentials to Claudish

### SSE Parser (`openai-responses-sse`)
Reads the Responses API streaming format and emits Anthropic-compatible events.
Event types handled:
- `response.output_text.delta` → `content_block_delta`
- `response.output_item.done` → `content_block_stop`
- `response.done` → `message_stop`
- `response.output_item.added` (function_call) → `content_block_start` with tool_use

---

## Provider Routing

Model prefix → provider resolution:

```
go@<model>    → provider: gemini-codeassist
               auth: ~/.claudish/gemini-oauth.json
               endpoint: cloudcode-pa.googleapis.com

cx@<model>    → provider: openai-codex
               auth: ~/.codex/auth.json (bridge) or ~/.claudish/codex-oauth.json
               endpoint: chatgpt.com/backend-api/codex/responses (ChatGPT Plus token)
                      OR api.openai.com/v1/responses (API key)

kc@<model>    → provider: kimi-coding
               auth: ~/.kimi/credentials/kimi-code.json (bridge) or ~/.claudish/kimi-oauth.json
               endpoint: api.kimi.com/coding/v1/messages

kimi@<model>  → provider: kimi
               auth: MOONSHOT_API_KEY env var
               endpoint: api.moonshot.ai/anthropic/v1/messages

oai@<model>   → provider: openai
               auth: OPENAI_API_KEY env var
               endpoint: api.openai.com/v1/chat/completions

or@<model>    → provider: openrouter
               auth: OPENROUTER_API_KEY env var
               endpoint: openrouter.ai/api/v1/chat/completions
```

---

## Token Flow: ChatGPT Plus (`cx@`)

The ChatGPT Plus token in `~/.codex/auth.json` is a **ChatGPT user session token**, not a standard OpenAI API key. Key properties:
- `aud: "https://api.openai.com/v1"` — intended for OpenAI API
- `iss: "https://auth.openai.com"` — issued by OpenAI auth server
- `chatgpt_plan_type: "plus"` — identifies subscription tier
- **Missing** `api.responses.write` scope — cannot use `api.openai.com/v1/responses`

This is why we route to `chatgpt.com/backend-api/codex/responses` instead of the standard API. The ChatGPT backend accepts subscription tokens directly.

The ChatGPT backend requires:
- `stream: true` (required, no non-streaming mode)
- `store: false` (required, ChatGPT Plus doesn't support persistence)
- `instructions` field (required, equivalent to system prompt)
- `max_output_tokens` must NOT be sent (unsupported parameter)

---

## Token Flow: Gemini Code Assist (`go@`)

Gemini Code Assist uses a Google OAuth 2.0 token scoped to the Code Assist service. The token is obtained via `claudish --gemini-login` (browser OAuth flow) and stored in `~/.claudish/gemini-oauth.json`. The endpoint is `cloudcode-pa.googleapis.com/v1internal:streamGenerateContent`.

---

## Credential File Locations

| Provider | Claudish-native | External CLI bridge |
|----------|----------------|---------------------|
| Gemini | `~/.claudish/gemini-oauth.json` | — |
| OpenAI Codex | `~/.claudish/codex-oauth.json` | `~/.codex/auth.json` (Codex CLI) |
| Kimi Coding | `~/.claudish/kimi-oauth.json` | `~/.kimi/credentials/kimi-code.json` (Kimi CLI) |
