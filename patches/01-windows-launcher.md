# Patch 01: Windows Launcher Fix

**File:** `node_modules/.bin/claudish.cmd` (npm global)  
**Problem:** Claudish's npm package ships a Node.js launcher (`bin/claudish.cjs`) that uses the Unix `which` command to locate Bun. On Windows, this command doesn't exist, causing Claudish to silently fail or error.

## Root Cause

`C:\Users\<you>\.bun\install\cache\claudish@7.0.1@@@1\bin\claudish.cjs`:

```js
function findBun() {
  try {
    // BUG: "which" doesn't exist on Windows — should be "where"
    const path = execSync("which bun", { encoding: "utf-8" }).trim();
    if (path) return path;
  } catch {}
  const candidates = [
    // BUG: No Windows path in original candidates list
    process.env.HOME + "/.bun/bin/bun",
    "/usr/local/bin/bun",
    ...
  ];
}
```

## The Fix

Replace the npm `.cmd` wrapper entirely with a direct Bun invocation, bypassing `claudish.cjs` completely. Claudish requires the Bun runtime anyway (`bun:ffi`, `Bun.spawn`), so calling Bun directly is both correct and simpler.

**`%APPDATA%\npm\claudish.cmd`:**
```cmd
@echo off
"C:\Users\<USERNAME>\.bun\bin\bun.exe" "C:\Users\<USERNAME>\.bun\install\cache\claudish@7.0.1@@@1\dist\index.js" %*
```

## Applying

Copy `scripts\claudish.cmd` from this repo to `%APPDATA%\npm\claudish.cmd`. Edit the two path references to match your Windows username.

Or use the auto-install script: `node patch-claudish.js`

## Alternative: Patch `claudish.cjs`

If you prefer to keep the Node.js launcher:
```js
function findBun() {
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const path = execSync(whichCmd + " bun", { encoding: "utf-8" })
      .trim().split("\n")[0].trim();
    if (path) return path;
  } catch {}
  const candidates = [
    process.env.USERPROFILE + "\\.bun\\bin\\bun.exe",  // ← added
    process.env.HOME + "/.bun/bin/bun",
    "/usr/local/bin/bun",
    "/opt/homebrew/bin/bun",
  ];
  ...
}
```
