# Patch 04: Codex Payload Requirements

**File:** `claudish@7.0.1@@@1/dist/index.js`  
**Classes modified:** `CodexAPIFormat`, `OpenAICodexTransport`

## Problem

The ChatGPT backend endpoint (`chatgpt.com/backend-api/codex/responses`) has stricter and different payload requirements than the standard Responses API (`api.openai.com/v1/responses`).

## Requirement 1: `store: false` (always required)

The ChatGPT backend requires explicit `"store": false`. Without it:
```json
{"detail":"Store must be set to false"}
```

**Fix in `CodexAPIFormat.buildPayload()`:**
```js
const payload = {
  model: this.modelId,
  input: convertedMessages,
  stream: true,
  store: false,    // ← always included
};
```

This is safe to include for the standard Responses API too, as `store: false` is the default there.

## Requirement 2: `instructions` (always required)

The ChatGPT backend requires the `instructions` field (equivalent to system prompt). Without it:
```json
{"detail":"Instructions are required"}
```

The original code only set `instructions` if `claudeRequest.system` was non-empty:
```js
// BEFORE (broken for ChatGPT backend):
if (claudeRequest.system) {
  payload.instructions = claudeRequest.system;
}

// AFTER (always set):
payload.instructions = claudeRequest.system || "You are a helpful assistant.";
```

## Requirement 3: `max_output_tokens` must NOT be sent

The ChatGPT backend rejects `max_output_tokens`:
```json
{"detail":"Unsupported parameter: max_output_tokens"}
```

The standard Responses API accepts it, so we can't remove it globally. Instead, `OpenAICodexTransport.transformPayload()` strips it when routing to the ChatGPT backend:

```js
transformPayload(payload) {
  if (this._useChatGPTBackend) {
    const { max_output_tokens, ...rest } = payload;
    return rest;
  }
  return payload;
}
```

`transformPayload()` is called at `ComposedHandler` line 33035, before the endpoint and headers are resolved. This is the correct hook point in Claudish's request pipeline.

## Full Payload Comparison

| Field | Standard Responses API | ChatGPT Backend |
|-------|----------------------|-----------------|
| `model` | required | required |
| `input` | required | required |
| `stream` | optional (default false) | **required, must be true** |
| `store` | optional (default true) | **required, must be false** |
| `instructions` | optional | **required** |
| `max_output_tokens` | optional | **must not be sent** |
| `tools` | optional | optional |
| `temperature` | optional | optional |

## Message Format Conversion

The Anthropic → Responses API message conversion (`convertMessagesToResponsesAPI`):

```
Anthropic format:
{ role: "user", content: "hello" }

Responses API format:
{ type: "message", role: "user", content: [{ type: "input_text", text: "hello" }] }

Anthropic format (tool call):
{ role: "assistant", tool_calls: [{ id, function: { name, arguments } }] }

Responses API format:
{ type: "function_call", call_id: id, name, arguments, status: "completed" }

Anthropic format (tool result):
{ role: "tool", tool_call_id: id, content: "result" }

Responses API format:
{ type: "function_call_output", call_id: id, output: "result" }
```

System messages are filtered out from the input array (they go into `instructions` instead).
