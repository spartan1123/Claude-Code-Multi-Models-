#!/usr/bin/env node
/**
 * patch-claudish.js
 *
 * Self-applying patch for Claudish v7.0.1 that enables:
 *   1. OpenAI Codex (cx@) via ChatGPT Plus subscription
 *   2. Kimi Coding (kc@) via Kimi CLI credentials bridge
 *
 * Usage:
 *   node patch-claudish.js
 *
 * Prerequisites:
 *   npm install -g claudish
 *   bun --version  (must be installed)
 *
 * What it patches:
 *   ~/.bun/install/cache/claudish@7.0.1@@@1/dist/index.js
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const CLAUDISH_VERSION = "7.0.1";
const CLAUDISH_DIST = path.join(
  os.homedir(),
  ".bun", "install", "cache",
  `claudish@${CLAUDISH_VERSION}@@@1`,
  "dist", "index.js"
);

// ─── Verify install ───────────────────────────────────────────────────────────
if (!fs.existsSync(CLAUDISH_DIST)) {
  console.error(`❌ Claudish dist not found at:\n   ${CLAUDISH_DIST}`);
  console.error(`\nInstall Claudish first:\n  npm install -g claudish\n`);
  process.exit(1);
}

let src = fs.readFileSync(CLAUDISH_DIST, "utf-8");
const backupPath = CLAUDISH_DIST + ".backup";

// ─── Backup original ──────────────────────────────────────────────────────────
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, src);
  console.log(`✅ Backup saved: ${backupPath}`);
} else {
  console.log(`ℹ️  Backup already exists, skipping.`);
}

let patchCount = 0;

function patch(description, searchStr, replaceStr) {
  if (!src.includes(searchStr)) {
    if (src.includes(replaceStr.slice(0, 60))) {
      console.log(`⏭  Already applied: ${description}`);
    } else {
      console.warn(`⚠️  Could not find patch target: ${description}`);
    }
    return;
  }
  src = src.replace(searchStr, replaceStr);
  console.log(`✅ Applied: ${description}`);
  patchCount++;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH 1: CodexAPIFormat.buildPayload — add store:false + default instructions
// ═══════════════════════════════════════════════════════════════════════════════
patch(
  "CodexAPIFormat.buildPayload — store:false + default instructions",
  `    buildPayload(claudeRequest, messages, tools) {
      const convertedMessages = this.convertMessagesToResponsesAPI(messages);
      const payload = {
        model: this.modelId,
        input: convertedMessages,
        stream: true
      };
      if (claudeRequest.system) {
        payload.instructions = claudeRequest.system;
      }
      if (claudeRequest.max_tokens) {`,
  `    buildPayload(claudeRequest, messages, tools) {
      const convertedMessages = this.convertMessagesToResponsesAPI(messages);
      const payload = {
        model: this.modelId,
        input: convertedMessages,
        stream: true,
        store: false
      };
      payload.instructions = claudeRequest.system || "You are a helpful assistant.";
      if (claudeRequest.max_tokens) {`
);

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH 2: CodexOAuth — add loadFromCodexCli() + modify loadCredentials()
// ═══════════════════════════════════════════════════════════════════════════════
patch(
  "CodexOAuth.loadCredentials — bridge to ~/.codex/auth.json",
  `  loadCredentials() {
    const credPath = this.getCredentialsPath();`,
  `  loadFromCodexCli() {
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
        const payload = JSON.parse(Buffer.from(tokens.access_token.split(".")[1], "base64url").toString("utf-8"));
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
      log(\`[CodexOAuth] Failed to load from Codex CLI: \${e.message}\`);
      return null;
    }
  }
  loadCredentials() {
    const codexCliCreds = this.loadFromCodexCli();
    if (codexCliCreds) return codexCliCreds;
    const credPath = this.getCredentialsPath();`
);

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH 3: OpenAICodexTransport — full replacement with endpoint routing
// ═══════════════════════════════════════════════════════════════════════════════
patch(
  "OpenAICodexTransport — ChatGPT backend routing + credential bridge",
  `  OpenAICodexTransport = class OpenAICodexTransport extends OpenAIProviderTransport {
    constructor(provider, modelName, apiKey) {
      super(provider, modelName, apiKey);
      this.streamFormat = "openai-responses-sse";
    }
    async getHeaders() {
      const oauthHeaders = await this.tryOAuthHeaders();
      if (oauthHeaders)
        return oauthHeaders;
      return super.getHeaders();
    }
    async tryOAuthHeaders() {
      const credPath = join17(homedir16(), ".claudish", "codex-oauth.json");
      if (!existsSync15(credPath))
        return null;
      try {
        const creds = JSON.parse(readFileSync12(credPath, "utf-8"));
        if (!creds.access_token || !creds.refresh_token)
          return null;
        const buffer = 5 * 60 * 1000;
        if (creds.expires_at && Date.now() > creds.expires_at - buffer) {
          const oauth = CodexOAuth.getInstance();
          const token = await oauth.getAccessToken();
          log("[OpenAI Codex] Using refreshed OAuth token");
          return buildOAuthHeaders(token, oauth.getAccountId());
        }
        log("[OpenAI Codex] Using OAuth token (subscription)");
        return buildOAuthHeaders(creds.access_token, creds.account_id);
      } catch (e) {
        log(\`[OpenAI Codex] OAuth credential read failed: \${e}, falling back to API key\`);
        return null;
      }
    }
  };`,
  `  OpenAICodexTransport = class OpenAICodexTransport extends OpenAIProviderTransport {
    _useChatGPTBackend = false;
    constructor(provider, modelName, apiKey) {
      super(provider, modelName, apiKey);
      this.streamFormat = "openai-responses-sse";
      try {
        const credPath = join17(homedir16(), ".claudish", "codex-oauth.json");
        if (!existsSync15(credPath)) {
          const codexPath = join17(homedir16(), ".codex", "auth.json");
          if (existsSync15(codexPath)) {
            const authFile = JSON.parse(readFileSync12(codexPath, "utf-8"));
            if (authFile?.auth_mode === "chatgpt" && authFile?.tokens?.access_token) {
              this._useChatGPTBackend = true;
              log("[OpenAI Codex] Constructor: detected ChatGPT token, using chatgpt.com backend");
            }
          }
        }
      } catch {}
    }
    getEndpoint() {
      if (this._useChatGPTBackend) {
        return "https://chatgpt.com/backend-api/codex/responses";
      }
      return \`\${this.provider.baseUrl}/v1/responses\`;
    }
    transformPayload(payload) {
      if (this._useChatGPTBackend) {
        const { max_output_tokens, ...rest } = payload;
        return rest;
      }
      return payload;
    }
    async getHeaders() {
      const oauthHeaders = await this.tryOAuthHeaders();
      if (oauthHeaders)
        return oauthHeaders;
      return super.getHeaders();
    }
    async tryOAuthHeaders() {
      const credPath = join17(homedir16(), ".claudish", "codex-oauth.json");
      if (existsSync15(credPath)) {
        try {
          const creds = JSON.parse(readFileSync12(credPath, "utf-8"));
          if (creds.access_token && creds.refresh_token) {
            const buffer = 5 * 60 * 1000;
            if (creds.expires_at && Date.now() > creds.expires_at - buffer) {
              const oauth = CodexOAuth.getInstance();
              const token = await oauth.getAccessToken();
              log("[OpenAI Codex] Using refreshed OAuth token");
              this._useChatGPTBackend = false;
              return buildOAuthHeaders(token, oauth.getAccountId());
            }
            log("[OpenAI Codex] Using OAuth token from codex-oauth.json (subscription)");
            this._useChatGPTBackend = false;
            return buildOAuthHeaders(creds.access_token, creds.account_id);
          }
        } catch (e) {
          log(\`[OpenAI Codex] OAuth credential read failed: \${e}, trying ~/.codex/auth.json\`);
        }
      }
      try {
        const codexPath = join17(homedir16(), ".codex", "auth.json");
        if (!existsSync15(codexPath)) return null;
        const authFile = JSON.parse(readFileSync12(codexPath, "utf-8"));
        if (!authFile || authFile.auth_mode !== "chatgpt") return null;
        const tokens = authFile.tokens;
        if (!tokens || !tokens.access_token) return null;
        log("[OpenAI Codex] Using credentials from ~/.codex/auth.json via chatgpt.com backend");
        this._useChatGPTBackend = true;
        return buildOAuthHeaders(tokens.access_token, tokens.account_id);
      } catch (e) {
        log(\`[OpenAI Codex] ~/.codex/auth.json read failed: \${e}\`);
        return null;
      }
    }
  };`
);

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH 4: KimiOAuth.pollForToken — fix missing refresh_token throwing
// ═══════════════════════════════════════════════════════════════════════════════
patch(
  "KimiOAuth.pollForToken — graceful missing refresh_token",
  `      if (result.access_token && result.refresh_token) {
        log("[KimiOAuth] Token received successfully");
        return result;
      }
      throw new Error("Invalid token response (missing access_token or refresh_token)");`,
  `      if (result.access_token) {
        if (!result.refresh_token) {
          log("[KimiOAuth] Warning: token response missing refresh_token, continuing with access_token only");
          result.refresh_token = "";
        }
        log("[KimiOAuth] Token received successfully");
        return result;
      }
      throw new Error("Invalid token response (missing access_token)");`
);

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH 5: kimi-coding transport — bridge to ~/.kimi/credentials/kimi-code.json
// ═══════════════════════════════════════════════════════════════════════════════
patch(
  "kimi-coding transport — bridge to Kimi CLI credentials",
  `    if (this.provider.name === "kimi-coding" && !this.apiKey) {
      try {
        const credPath = join19(homedir18(), ".claudish", "kimi-oauth.json");
        if (existsSync17(credPath)) {
          const data = JSON.parse(readFileSync14(credPath, "utf-8"));
          if (data.access_token && data.refresh_token) {
            const oauth = KimiOAuth.getInstance();
            const accessToken = await oauth.getAccessToken();
            delete headers["x-api-key"];
            headers["Authorization"] = \`Bearer \${accessToken}\`;
            const platformHeaders = oauth.getPlatformHeaders();
            Object.assign(headers, platformHeaders);
          }
        }
      } catch (e) {
        log(\`[\${this.displayName}] OAuth fallback failed: \${e.message}\`);
      }
    }`,
  `    if (this.provider.name === "kimi-coding" && !this.apiKey) {
      try {
        const credPath = join19(homedir18(), ".claudish", "kimi-oauth.json");
        const kimiCliPath = join19(homedir18(), ".kimi", "credentials", "kimi-code.json");
        let accessToken = null;
        if (existsSync17(credPath)) {
          const data = JSON.parse(readFileSync14(credPath, "utf-8"));
          if (data.access_token) {
            const oauth = KimiOAuth.getInstance();
            accessToken = await oauth.getAccessToken();
            log("[Kimi Coding] Using OAuth token from kimi-oauth.json");
          }
        } else if (existsSync17(kimiCliPath)) {
          const data = JSON.parse(readFileSync14(kimiCliPath, "utf-8"));
          if (data.access_token) {
            const now = Date.now();
            const expiresAt = data.expires_at ? data.expires_at * 1000 : 0;
            if (expiresAt > now + 60000) {
              accessToken = data.access_token;
              log("[Kimi Coding] Using credentials from ~/.kimi/credentials/kimi-code.json");
            } else {
              log("[Kimi Coding] ~/.kimi/credentials/kimi-code.json token is expired — run: kimi login");
            }
          }
        }
        if (accessToken) {
          delete headers["x-api-key"];
          headers["Authorization"] = \`Bearer \${accessToken}\`;
          const platformHeaders = KimiOAuth.getInstance().getPlatformHeaders();
          Object.assign(headers, platformHeaders);
        }
      } catch (e) {
        log(\`[\${this.displayName}] OAuth fallback failed: \${e.message}\`);
      }
    }`
);

// ─── Write patched file ───────────────────────────────────────────────────────
fs.writeFileSync(CLAUDISH_DIST, src);
console.log(`\n${"═".repeat(60)}`);
console.log(`✅ Patched ${patchCount} location(s) in:`);
console.log(`   ${CLAUDISH_DIST}`);
console.log(`\nNext steps:`);
console.log(`  1. Copy scripts/claudish.cmd to %APPDATA%\\npm\\claudish.cmd`);
console.log(`     (edit the two paths to match your username)`);
console.log(`  2. Gemini: claudish --gemini-login`);
console.log(`  3. Codex:  codex login`);
console.log(`  4. Test:   claudish --model cx@gpt-5.4 "say hello"`);
console.log(`             claudish --model go@gemini-2.5-pro "say hello"`);
console.log(`${"═".repeat(60)}\n`);
