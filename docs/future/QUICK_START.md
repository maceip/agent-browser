# Quick Start - Preventing Past Pain

This guide gets you from zero to working agent-browser, with **zero debugging nightmares**.

---

## Prerequisites

```bash
# Required versions
rust --version  # 1.75+
bun --version   # 1.0+
chrome --version # 120+
```

---

## Step 1: Generate Extension Key (ONCE ONLY)

```bash
cd /Users/rpm/agent-browser/extension

# Generate RSA key pair (DO THIS ONCE, COMMIT TO GIT)
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in private_key.pem -outform DER -out public_key.der
openssl base64 -in public_key.der -out public_key.b64 -A

# CRITICAL: Commit these files
git add private_key.pem public_key.b64
git commit -m "Add stable extension key"

echo "✅ Extension key generated - NEVER regenerate this"
```

**Why:** This ensures stable extension ID across builds

---

## Step 2: Build Extension

```bash
cd extension

# Install dependencies
bun install

# Build (auto-computes ID, injects key, verifies)
bun run build

# Check build output
ls -la .output/chrome-mv3/

# Verify extension ID was computed
cat EXTENSION_ID
```

**Expected output:**
```
✅ Injected stable extension key
✅ Extension built
✅ Manifest has stable key
Expected Extension ID: abcdefghijklmnop...
✅ Build verification passed
```

---

## Step 3: Build Server

```bash
cd ../server

# Build release binaries
cargo build --release

# Verify binaries exist
ls -la target/release/agent-browser-nmh
ls -la target/release/agent-browser-server

echo "✅ Server built"
```

---

## Step 4: Install Native Messaging Host

```bash
cd ..

# Run installation script (requires sudo)
./scripts/install-nmh.sh
```

**Expected output:**
```
Extension ID: abcdefghijklmnop...
Building server binary...
Installing server binary to /usr/local/bin...
Creating NMH manifest at ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/...
✅ NMH manifest created
✅ Installation complete!
```

**What this does:**
1. Reads extension ID from `extension/EXTENSION_ID`
2. Copies binaries to `/usr/local/bin/`
3. Creates NMH manifest with correct extension ID
4. Installs for both Chrome and Chrome Canary

---

## Step 5: Verify Installation

```bash
./scripts/verify-installation.sh
```

**Expected output:**
```
1️⃣ Checking extension build...
✅ Extension built
✅ Manifest has stable key
Expected Extension ID: abcdefghijklmnop...

2️⃣ Testing server startup...
✅ Server started successfully (PID: 12345)

✅ All verification checks passed!
```

**If any check fails:** See [INSTALLATION.md](./INSTALLATION.md) troubleshooting section

---

## Step 6: Load Extension in Chrome

```bash
# Open Chrome extensions page
open "chrome://extensions/"

# Or manually:
# 1. Open chrome://extensions
# 2. Enable "Developer mode" (top right)
# 3. Click "Load unpacked"
# 4. Select: /Users/rpm/agent-browser/extension/.output/chrome-mv3
```

**Verify extension ID matches:**

```bash
# Check expected ID
cat extension/EXTENSION_ID

# Compare to actual ID in chrome://extensions
# They MUST match
```

---

## Step 7: Test NMH Connection

**In Chrome extension console:**

```javascript
// Test native messaging host
chrome.runtime.sendNativeMessage(
  'com.agentbrowser.native',
  { cmd: 'ensure_server' },
  (response) => {
    console.log('NMH Response:', response);
    // Should see: { ok: true, host: "localhost", port: 8085, scheme: "ws", ... }
  }
);
```

**Expected:** Server starts, WebSocket ready on `localhost:8085`

---

## Step 8: Test WebSocket Connection

**In extension background console:**

```javascript
// Check connection status
__wsDebug.status()
// Should show: { state: "AUTHENTICATED", sessionId: "uuid", ... }
```

**Or manually connect with websocat:**

```bash
# Install websocat
brew install websocat

# Connect
websocat ws://localhost:8085

# Send HELLO (paste this JSON)
{"version":"1.0.0","type":"hello","id":"test-123","timestamp":1704067200000,"payload":{"extensionId":"abcdefghijklmnopqrstuvwxyzabcdef","extensionVersion":"0.1.0","capabilities":["navigate","click"],"tabCount":1}}

# Should receive HELLO_ACK
```

**Expected:** Server responds with `HELLO_ACK`, session established

---

## Step 9: Test MCP Command

**From terminal:**

```bash
# TODO: Add MCP stdio integration test
# For now, test via extension console

# In extension console
chrome.runtime.sendMessage({
  type: 'route-webtransport-command',
  action: 'navigate',
  params: { url: 'https://aol.com', tabId: 123 }
}, console.log);
```

**Expected:** Navigation works, response returned

---

## Troubleshooting

### Extension ID Mismatch

**Symptom:** NMH returns "Access to native messaging is not allowed"

**Fix:**
```bash
# Rebuild extension
cd extension
rm -rf .output
bun run build

# Reinstall NMH with new ID
cd ..
./scripts/install-nmh.sh

# Reload extension in Chrome
```

### Server Won't Start

**Symptom:** NMH logs "Server binary not found"

**Fix:**
```bash
# Check binary exists
ls -la /usr/local/bin/web-transport-server

# Reinstall if missing
cd server
cargo build --release
sudo cp target/release/agent-browser-server /usr/local/bin/web-transport-server
sudo chmod +x /usr/local/bin/web-transport-server
```

### WebSocket Connection Fails

**Symptom:** Extension console shows "WebSocket error"

**Fix:**
```bash
# Check server is running
lsof -i :8085

# If not, start manually
/usr/local/bin/web-transport-server

# Check logs
tail -f /tmp/agent-browser-server.log
```

### Content Script Not Injecting

**Symptom:** Commands fail with "No content script"

**Fix:**
```bash
# In extension background console
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    files: ['content-scripts/index.js']
  });
});
```

---

## Common Issues Reference

See [INSTALLATION.md](./INSTALLATION.md) for complete troubleshooting guide.

**Quick links:**
- Extension ID issues → INSTALLATION.md#extension-id-mismatch
- NMH not found → INSTALLATION.md#nmh-manifest-not-found
- Server binary issues → INSTALLATION.md#nmh-cant-find-server-binary
- Connection protocol → CONNECTION_PROTOCOL.md

---

## Development Workflow

### After Extension Changes

```bash
cd extension
bun run build
# Reload extension in chrome://extensions
```

### After Server Changes

```bash
cd server
cargo build --release
sudo cp target/release/agent-browser-server /usr/local/bin/web-transport-server
pkill -f web-transport-server  # Kill running server
# NMH will restart on next request
```

### After NMH Shim Changes

```bash
cd server
cargo build --release
sudo cp target/release/agent-browser-nmh /usr/local/bin/agent-browser-nmh
# Restart Chrome to reload NMH binary
```

---

## Success Checklist

Before considering setup complete:

- [ ] Extension ID stable across rebuilds
- [ ] NMH manifest extension ID matches actual
- [ ] Server binary executable at `/usr/local/bin/web-transport-server`
- [ ] NMH binary executable at `/usr/local/bin/agent-browser-nmh`
- [ ] Extension loads without errors
- [ ] NMH connection works (test in console)
- [ ] WebSocket authenticates (HELLO → HELLO_ACK)
- [ ] MCP command executes successfully
- [ ] `verify-installation.sh` passes all checks

---

## Next Steps

Once setup complete:

1. **Read:** [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
2. **Read:** [CONNECTION_PROTOCOL.md](./CONNECTION_PROTOCOL.md) - Message format
3. **Implement:** Start with Phase 1 (core plumbing)
4. **Test:** Run `bun test` after each feature

---

## Files You Should Have

```
agent-browser/
├── extension/
│   ├── private_key.pem      ✅ Committed to git
│   ├── public_key.b64       ✅ Committed to git
│   ├── EXTENSION_ID         ✅ Auto-generated, committed
│   └── .output/chrome-mv3/  ❌ Build output, not committed
├── server/
│   └── target/release/
│       ├── agent-browser-nmh           ✅ Built binary
│       └── agent-browser-server        ✅ Built binary
└── /usr/local/bin/
    ├── agent-browser-nmh               ✅ Installed system-wide
    └── web-transport-server            ✅ Installed system-wide
```

---

## Emergency Reset

If everything is broken:

```bash
cd /Users/rpm/agent-browser

# Clean build artifacts
rm -rf extension/.output extension/node_modules
rm -rf server/target

# Rebuild everything
cd extension
bun install
bun run build

cd ../server
cargo build --release

# Reinstall
cd ..
./scripts/install-nmh.sh
./scripts/verify-installation.sh

# Remove and re-add extension in Chrome
```

**DO NOT regenerate extension keys** unless you're okay with a new extension ID.

---

## Help

If stuck:
1. Run `./scripts/verify-installation.sh`
2. Check specific error in [INSTALLATION.md](./INSTALLATION.md)
3. Review [CONNECTION_PROTOCOL.md](./CONNECTION_PROTOCOL.md) for message issues
4. Search for error message in docs
