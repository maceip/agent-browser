# Installation Guide - CRITICAL SETUP

This guide prevents the **weeks of debugging** we experienced with:
- ❌ Extension ID drift
- ❌ NMH manifest in wrong location
- ❌ NMH not finding server binary
- ❌ Extension allowlist mismatches

**Follow these steps EXACTLY to avoid pain.**

---

## Table of Contents

1. [Extension ID Management](#1-extension-id-management)
2. [Native Messaging Host Setup](#2-native-messaging-host-setup)
3. [Server Binary Installation](#3-server-binary-installation)
4. [Verification Steps](#4-verification-steps)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Extension ID Management

### Problem We Had
- Extension ID changed every rebuild → NMH allowlist broke
- Manual ID updates in 3+ places → easy to miss
- No automation → human error

### Solution: Bake Public Key into Extension

#### Step 1: Generate Key Once (NEVER REGENERATE)

```bash
cd extension

# Generate RSA key pair (DO THIS ONCE ONLY)
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048

# Extract public key in DER format
openssl rsa -pubout -in private_key.pem -outform DER -out public_key.der

# Convert to base64 for manifest
openssl base64 -in public_key.der -out public_key.b64 -A

# CRITICAL: Commit these files to git
git add private_key.pem public_key.b64
git commit -m "Add stable extension key"
```

**⚠️ WARNING:** Once committed, NEVER delete or regenerate these files. The extension ID is derived from the public key.

#### Step 2: Auto-Inject Key into Manifest

**File:** `extension/wxt.config.ts`

```typescript
import { defineConfig } from 'wxt';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  extensionApi: 'chrome',
  manifest: {
    name: 'Agent Browser',
    permissions: [
      'tabs',
      'scripting',
      'nativeMessaging',
      'storage'
    ],
    host_permissions: ['<all_urls>']
  },
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      // CRITICAL: Inject stable public key
      const keyPath = path.join(wxt.config.root, 'public_key.b64');
      if (fs.existsSync(keyPath)) {
        const key = fs.readFileSync(keyPath, 'utf8').trim();
        manifest.key = key;
        console.log('✅ Injected stable extension key');
      } else {
        throw new Error('❌ public_key.b64 not found! Run key generation script.');
      }
    }
  }
});
```

#### Step 3: Compute Expected Extension ID

**File:** `scripts/compute-extension-id.js`

```javascript
#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Read public key
const keyPath = path.join(__dirname, '../extension/public_key.b64');
const base64Key = fs.readFileSync(keyPath, 'utf8').trim();

// Decode base64
const derKey = Buffer.from(base64Key, 'base64');

// Compute SHA256 hash
const hash = crypto.createHash('sha256').update(derKey).digest();

// Take first 128 bits (16 bytes)
const truncated = hash.slice(0, 16);

// Convert to lowercase hex, then map to a-p (Chrome's alphabet)
const alphabet = 'abcdefghijklmnop';
let extensionId = '';
for (const byte of truncated) {
  extensionId += alphabet[byte >> 4];
  extensionId += alphabet[byte & 0x0f];
}

console.log('Expected Extension ID:', extensionId);

// Verify it matches manifest
const manifestPath = path.join(__dirname, '../extension/.output/chrome-mv3/manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.key === base64Key) {
    console.log('✅ Manifest key matches');
  } else {
    console.error('❌ Manifest key MISMATCH!');
    process.exit(1);
  }
}

// Write to file for NMH installation script
const idFilePath = path.join(__dirname, '../extension/EXTENSION_ID');
fs.writeFileSync(idFilePath, extensionId);
console.log('✅ Wrote extension ID to extension/EXTENSION_ID');
```

**Make executable:**
```bash
chmod +x scripts/compute-extension-id.js
```

#### Step 4: Automated Build Check

**File:** `extension/package.json`

```json
{
  "scripts": {
    "prebuild": "node ../scripts/compute-extension-id.js",
    "build": "wxt build",
    "postbuild": "node ../scripts/verify-build.js",
    "dev": "wxt",
    "test": "bun test"
  }
}
```

**File:** `scripts/verify-build.js`

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '../extension/.output/chrome-mv3/manifest.json');
const expectedIdPath = path.join(__dirname, '../extension/EXTENSION_ID');

if (!fs.existsSync(manifestPath)) {
  console.error('❌ Build output not found');
  process.exit(1);
}

if (!fs.existsSync(expectedIdPath)) {
  console.error('❌ EXTENSION_ID file not found. Run prebuild script first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const expectedId = fs.readFileSync(expectedIdPath, 'utf8').trim();

if (!manifest.key) {
  console.error('❌ Manifest missing "key" field!');
  process.exit(1);
}

console.log('Expected Extension ID:', expectedId);
console.log('✅ Manifest contains stable key');
console.log('✅ Build verification passed');
```

---

## 2. Native Messaging Host Setup

### Problem We Had
- NMH manifest in wrong location → Chrome can't find it
- Extension ID hardcoded → broke on every rebuild
- Path to server binary wrong → NMH can't launch server

### Solution: Automated Installation Script

**File:** `scripts/install-nmh.sh`

```bash
#!/bin/bash
set -e

echo "🔧 Installing Native Messaging Host for Agent Browser..."

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
  NMH_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  CHROME_CANARY_DIR="$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OS="linux"
  NMH_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
  CHROME_CANARY_DIR="$HOME/.config/google-chrome-beta/NativeMessagingHosts"
else
  echo "❌ Unsupported OS: $OSTYPE"
  exit 1
fi

# Read expected extension ID
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_ID_FILE="$SCRIPT_DIR/../extension/EXTENSION_ID"

if [ ! -f "$EXTENSION_ID_FILE" ]; then
  echo "❌ EXTENSION_ID file not found!"
  echo "Run: cd extension && bun run build"
  exit 1
fi

EXTENSION_ID=$(cat "$EXTENSION_ID_FILE")
echo "Extension ID: $EXTENSION_ID"

# Build server binary
echo "Building server binary..."
cd "$SCRIPT_DIR/../server"
cargo build --release --bin agent-browser-nmh

# Copy binary to system location
SERVER_BIN_DIR="/usr/local/bin"
SERVER_BIN_NAME="agent-browser-server"
ACTUAL_SERVER_BIN_NAME="web-transport-server" # What NMH expects

echo "Installing server binary to $SERVER_BIN_DIR..."
sudo cp target/release/agent-browser-nmh "$SERVER_BIN_DIR/$SERVER_BIN_NAME"
sudo chmod +x "$SERVER_BIN_DIR/$SERVER_BIN_NAME"

# Also copy actual server binary
cargo build --release --bin agent-browser-server
sudo cp target/release/agent-browser-server "$SERVER_BIN_DIR/$ACTUAL_SERVER_BIN_NAME"
sudo chmod +x "$SERVER_BIN_DIR/$ACTUAL_SERVER_BIN_NAME"

# Create NMH manifest
NMH_MANIFEST_NAME="com.agentbrowser.native"
NMH_MANIFEST_PATH="$NMH_DIR/$NMH_MANIFEST_NAME.json"

echo "Creating NMH manifest at $NMH_MANIFEST_PATH..."
mkdir -p "$NMH_DIR"

cat > "$NMH_MANIFEST_PATH" <<EOF
{
  "name": "$NMH_MANIFEST_NAME",
  "description": "Agent Browser Native Messaging Host",
  "path": "$SERVER_BIN_DIR/$SERVER_BIN_NAME",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "✅ NMH manifest created"
cat "$NMH_MANIFEST_PATH"

# Also install for Chrome Canary if it exists
if [ -d "$(dirname "$CHROME_CANARY_DIR")" ]; then
  echo "Installing for Chrome Canary..."
  mkdir -p "$CHROME_CANARY_DIR"
  cp "$NMH_MANIFEST_PATH" "$CHROME_CANARY_DIR/$NMH_MANIFEST_NAME.json"
  echo "✅ Canary manifest created"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Load extension from: $SCRIPT_DIR/../extension/.output/chrome-mv3"
echo "2. Verify extension ID matches: $EXTENSION_ID"
echo "3. Test with: chrome.runtime.sendNativeMessage('$NMH_MANIFEST_NAME', {cmd:'ensure_server'}, console.log)"
```

**Make executable:**
```bash
chmod +x scripts/install-nmh.sh
```

---

## 3. Server Binary Installation

### Problem We Had
- NMH binary in wrong location → NMH can't execute it
- Server binary name mismatch → NMH launches wrong binary
- Binary permissions wrong → Permission denied errors

### Solution: Standardized Binary Locations

**File:** `server/Cargo.toml`

```toml
[package]
name = "agent-browser-server"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "agent-browser-nmh"
path = "src/bin/nmh_shim.rs"

[[bin]]
name = "agent-browser-server"
path = "src/main.rs"

[dependencies]
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.23"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
```

**Binary naming convention:**
- `agent-browser-nmh` → NMH shim (Chrome launches this)
- `web-transport-server` → Actual server (NMH launches this)
  - Named `web-transport-server` because NMH shim hardcodes this name

**File:** `server/src/bin/nmh_shim.rs`

```rust
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::env;

#[derive(Debug, Deserialize)]
struct NmhRequest {
    #[serde(default)]
    cmd: String,
}

#[derive(Debug, Serialize)]
struct NmhResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    logs: Option<String>,
    host: String,
    port: u16,
    scheme: String,
}

fn write_native_message<T: Serialize>(value: &T) -> Result<()> {
    let json = serde_json::to_vec(value)?;
    let len = json.len() as u32;

    std::io::stdout().write_all(&len.to_le_bytes())?;
    std::io::stdout().write_all(&json)?;
    std::io::stdout().flush()?;
    Ok(())
}

fn read_native_message() -> Result<serde_json::Value> {
    let mut len_bytes = [0u8; 4];
    std::io::stdin().read_exact(&mut len_bytes)?;
    let len = u32::from_le_bytes(len_bytes) as usize;

    let mut buf = vec![0u8; len];
    std::io::stdin().read_exact(&mut buf)?;
    Ok(serde_json::from_slice(&buf)?)
}

fn is_server_running() -> bool {
    std::net::TcpStream::connect("127.0.0.1:8085").is_ok()
}

fn spawn_server() -> Result<String> {
    let mut logs = String::new();

    // CRITICAL: Find server binary in same directory as this NMH binary
    let nmh_path = env::current_exe()
        .context("Failed to get NMH binary path")?;

    let nmh_dir = nmh_path.parent()
        .context("Failed to get NMH parent directory")?;

    // Server binary is named "web-transport-server" (legacy name from webtrans)
    // We keep this name for compatibility
    let server_path = nmh_dir.join("web-transport-server");

    if !server_path.exists() {
        logs.push_str(&format!("❌ Server binary not found at: {:?}\n", server_path));
        logs.push_str("Expected location: Same directory as NMH binary\n");
        return Err(anyhow::anyhow!("Server binary not found"));
    }

    logs.push_str(&format!("✅ Found server binary at: {:?}\n", server_path));

    // Spawn server detached
    let child = Command::new(&server_path)
        .env("RUST_LOG", "info")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .context("Failed to spawn server")?;

    logs.push_str(&format!("✅ Server started with PID: {}\n", child.id()));

    // Wait for server to start
    std::thread::sleep(std::time::Duration::from_millis(1000));

    if is_server_running() {
        logs.push_str("✅ Server is now running on localhost:8085\n");
    } else {
        logs.push_str("⚠️ Warning: Server may not have started properly\n");
    }

    Ok(logs)
}

fn main() -> Result<()> {
    // Read request from Chrome
    let request = read_native_message().context("Failed to read native message")?;
    eprintln!("NMH request: {}", request);

    let req: NmhRequest = serde_json::from_value(request)
        .unwrap_or(NmhRequest { cmd: String::new() });

    let mut logs = String::new();
    let mut error = None;

    if is_server_running() {
        logs.push_str("✅ Server already running\n");
    } else {
        logs.push_str("⚠️ Server not running, starting it...\n");
        match spawn_server() {
            Ok(spawn_logs) => logs.push_str(&spawn_logs),
            Err(e) => {
                error = Some(format!("Failed to start server: {}", e));
                logs.push_str(&format!("❌ Error: {}\n", e));
            }
        }
    }

    // Send response
    let response = NmhResponse {
        ok: error.is_none(),
        error,
        logs: if logs.is_empty() { None } else { Some(logs) },
        host: "localhost".into(),
        port: 8085,
        scheme: "ws".into(), // WebSocket, not https
    };

    write_native_message(&response)?;
    Ok(())
}
```

---

## 4. Verification Steps

### CRITICAL: Run These After Every Build

**File:** `scripts/verify-installation.sh`

```bash
#!/bin/bash
set -e

echo "🔍 Verifying Agent Browser installation..."

# 1. Check extension build
echo ""
echo "1️⃣ Checking extension build..."
MANIFEST_PATH="extension/.output/chrome-mv3/manifest.json"
if [ ! -f "$MANIFEST_PATH" ]; then
  echo "❌ Extension not built. Run: cd extension && bun run build"
  exit 1
fi
echo "✅ Extension built"

# 2. Check extension has stable key
if ! grep -q '"key":' "$MANIFEST_PATH"; then
  echo "❌ Manifest missing stable key!"
  exit 1
fi
echo "✅ Manifest has stable key"

# 3. Check extension ID matches
EXPECTED_ID=$(cat extension/EXTENSION_ID)
echo "Expected Extension ID: $EXPECTED_ID"

# 4. Check NMH manifest exists
if [[ "$OSTYPE" == "darwin"* ]]; then
  NMH_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
else
  NMH_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
fi

NMH_MANIFEST="$NMH_DIR/com.agentbrowser.native.json"
if [ ! -f "$NMH_MANIFEST" ]; then
  echo "❌ NMH manifest not found at: $NMH_MANIFEST"
  echo "Run: ./scripts/install-nmh.sh"
  exit 1
fi
echo "✅ NMH manifest exists"

# 5. Check NMH manifest has correct extension ID
if ! grep -q "$EXPECTED_ID" "$NMH_MANIFEST"; then
  echo "❌ NMH manifest has wrong extension ID!"
  echo "Expected: $EXPECTED_ID"
  echo "Manifest contents:"
  cat "$NMH_MANIFEST"
  exit 1
fi
echo "✅ NMH manifest has correct extension ID"

# 6. Check NMH binary exists
NMH_BIN=$(grep '"path"' "$NMH_MANIFEST" | sed 's/.*"path": "\(.*\)".*/\1/')
if [ ! -f "$NMH_BIN" ]; then
  echo "❌ NMH binary not found at: $NMH_BIN"
  exit 1
fi
echo "✅ NMH binary exists at: $NMH_BIN"

# 7. Check server binary exists
SERVER_BIN="/usr/local/bin/web-transport-server"
if [ ! -f "$SERVER_BIN" ]; then
  echo "❌ Server binary not found at: $SERVER_BIN"
  exit 1
fi
echo "✅ Server binary exists at: $SERVER_BIN"

# 8. Check server binary is executable
if [ ! -x "$SERVER_BIN" ]; then
  echo "❌ Server binary not executable!"
  exit 1
fi
echo "✅ Server binary is executable"

# 9. Check server can start
echo ""
echo "2️⃣ Testing server startup..."
$SERVER_BIN &
SERVER_PID=$!
sleep 2

if ps -p $SERVER_PID > /dev/null; then
  echo "✅ Server started successfully (PID: $SERVER_PID)"
  kill $SERVER_PID
else
  echo "❌ Server failed to start"
  exit 1
fi

echo ""
echo "✅ All verification checks passed!"
echo ""
echo "Ready to use Agent Browser:"
echo "1. Load unpacked extension from: extension/.output/chrome-mv3"
echo "2. Extension ID should be: $EXPECTED_ID"
echo "3. Test NMH: chrome.runtime.sendNativeMessage('com.agentbrowser.native', {cmd:'ensure_server'}, console.log)"
```

**Make executable:**
```bash
chmod +x scripts/verify-installation.sh
```

---

## 5. Troubleshooting

### Issue: Extension ID Changes After Build

**Symptoms:**
- Extension loads with different ID each time
- NMH manifest allowlist doesn't match
- `chrome.runtime.sendNativeMessage` returns error

**Root Cause:**
- `public_key.b64` not injected into manifest

**Fix:**
```bash
# 1. Verify key file exists
ls -la extension/public_key.b64

# 2. Verify wxt.config.ts has injection hook
grep -A 10 'build:manifestGenerated' extension/wxt.config.ts

# 3. Rebuild
cd extension
bun run build

# 4. Check manifest has key
grep '"key"' .output/chrome-mv3/manifest.json

# 5. Compute expected ID
node ../scripts/compute-extension-id.js
```

---

### Issue: NMH Manifest Not Found

**Symptoms:**
- Extension can't communicate with native host
- Console error: "Specified native messaging host not found"

**Root Cause:**
- NMH manifest in wrong location
- Chrome looking in different directory

**Fix:**
```bash
# 1. Find Chrome's NMH directory
# macOS Chrome:
ls -la "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/"

# macOS Chrome Canary:
ls -la "$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts/"

# Linux:
ls -la "$HOME/.config/google-chrome/NativeMessagingHosts/"

# 2. Verify manifest exists
cat "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.agentbrowser.native.json"

# 3. Reinstall if missing
./scripts/install-nmh.sh
```

---

### Issue: NMH Can't Find Server Binary

**Symptoms:**
- NMH runs but returns error: "Server binary not found"
- Logs show: "Expected location: /usr/local/bin/web-transport-server"

**Root Cause:**
- Server binary not installed to `/usr/local/bin`
- Binary has wrong name

**Fix:**
```bash
# 1. Check server binary exists
ls -la /usr/local/bin/web-transport-server

# 2. Check NMH binary exists
ls -la /usr/local/bin/agent-browser-nmh

# 3. Reinstall
cd server
cargo build --release
sudo cp target/release/agent-browser-server /usr/local/bin/web-transport-server
sudo cp target/release/agent-browser-nmh /usr/local/bin/agent-browser-nmh
sudo chmod +x /usr/local/bin/web-transport-server
sudo chmod +x /usr/local/bin/agent-browser-nmh

# 4. Update NMH manifest path
./scripts/install-nmh.sh
```

---

### Issue: Extension ID Mismatch

**Symptoms:**
- Extension loads but NMH returns permission error
- Console: "Access to native messaging is not allowed"

**Root Cause:**
- Extension ID in NMH manifest doesn't match actual extension ID

**Fix:**
```bash
# 1. Get actual extension ID from Chrome
# Method 1: chrome://extensions (look at ID under extension)
# Method 2: Run in extension console:
chrome.runtime.id

# 2. Compare to expected ID
cat extension/EXTENSION_ID

# 3. If they don't match, rebuild extension
cd extension
rm -rf .output
bun run build

# 4. Reinstall NMH with correct ID
./scripts/install-nmh.sh

# 5. Reload extension in Chrome
```

---

### Issue: Permission Denied When Launching Server

**Symptoms:**
- NMH logs: "Permission denied: /usr/local/bin/web-transport-server"

**Root Cause:**
- Binary not executable
- Binary owned by root with wrong permissions

**Fix:**
```bash
# 1. Fix permissions
sudo chmod +x /usr/local/bin/web-transport-server
sudo chmod +x /usr/local/bin/agent-browser-nmh

# 2. Verify
ls -la /usr/local/bin/agent-browser*
# Should show: -rwxr-xr-x

# 3. Test manually
/usr/local/bin/web-transport-server
# Should start server on port 8085
```

---

## Complete Installation Workflow

**Run these commands in order:**

```bash
# 1. Generate extension key (ONCE ONLY, then commit to git)
cd extension
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in private_key.pem -outform DER -out public_key.der
openssl base64 -in public_key.der -out public_key.b64 -A
git add private_key.pem public_key.b64
git commit -m "Add stable extension key"

# 2. Build extension
bun install
bun run build
# This runs prebuild (compute ID) → build → postbuild (verify)

# 3. Build server
cd ../server
cargo build --release

# 4. Install NMH
cd ..
./scripts/install-nmh.sh
# Requires sudo for copying binaries to /usr/local/bin

# 5. Verify everything
./scripts/verify-installation.sh

# 6. Load extension in Chrome
# - Go to chrome://extensions
# - Enable Developer mode
# - Click "Load unpacked"
# - Select: agent-browser/extension/.output/chrome-mv3
# - Verify ID matches output from step 2

# 7. Test NMH connection
# In extension console:
chrome.runtime.sendNativeMessage(
  'com.agentbrowser.native',
  { cmd: 'ensure_server' },
  (response) => {
    console.log('NMH Response:', response);
    // Should see: { ok: true, host: "localhost", port: 8085, ... }
  }
);
```

---

## Development Workflow

**After making changes:**

```bash
# Extension changes
cd extension
bun run build          # Prebuild auto-computes ID, postbuild verifies
# Reload extension in chrome://extensions

# Server changes
cd server
cargo build --release
sudo cp target/release/agent-browser-server /usr/local/bin/web-transport-server
# Kill running server: pkill -f web-transport-server
# NMH will restart it on next request

# NMH shim changes
cd server
cargo build --release
sudo cp target/release/agent-browser-nmh /usr/local/bin/agent-browser-nmh
# Restart Chrome to reload NMH binary
```

---

## Automation Checklist

✅ **What's Automated:**
- [x] Extension ID computation from public key
- [x] Manifest key injection during build
- [x] Build verification (checks key present)
- [x] NMH manifest generation with correct extension ID
- [x] Binary installation to standard locations

✅ **What to Do Once:**
- [x] Generate extension key pair (commit to git)
- [x] Set up wxt.config.ts hook
- [x] Create installation scripts

✅ **What to Do Every Build:**
- [x] Run `bun run build` (auto-runs verification)
- [x] Run `./scripts/install-nmh.sh` (if extension ID changed)
- [x] Run `./scripts/verify-installation.sh` (before testing)

✅ **What to NEVER Do:**
- [ ] Regenerate extension keys (breaks installed NMH manifests)
- [ ] Manually edit extension ID in code
- [ ] Install binaries to custom locations
- [ ] Skip verification steps

---

## Files to Commit to Git

**ALWAYS commit:**
```
extension/
  private_key.pem        # ✅ Commit (needed for consistent ID)
  public_key.b64         # ✅ Commit (injected into manifest)
  EXTENSION_ID           # ✅ Commit (reference for NMH)
  wxt.config.ts          # ✅ Commit (auto-injection hook)

scripts/
  install-nmh.sh         # ✅ Commit (installation automation)
  compute-extension-id.js # ✅ Commit (ID computation)
  verify-build.js        # ✅ Commit (build verification)
  verify-installation.sh # ✅ Commit (full verification)
```

**NEVER commit:**
```
extension/
  .output/               # ❌ Build output
  node_modules/          # ❌ Dependencies

server/
  target/                # ❌ Build output
```

---

## Quick Reference

| Item | Location | How to Get |
|------|----------|------------|
| **Extension ID** | `extension/EXTENSION_ID` | `node scripts/compute-extension-id.js` |
| **Extension Build** | `extension/.output/chrome-mv3/` | `cd extension && bun run build` |
| **NMH Manifest** | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.agentbrowser.native.json` (macOS) | `./scripts/install-nmh.sh` |
| **NMH Binary** | `/usr/local/bin/agent-browser-nmh` | `cd server && cargo build --release` then install script |
| **Server Binary** | `/usr/local/bin/web-transport-server` | `cd server && cargo build --release` then install script |
| **Verify All** | - | `./scripts/verify-installation.sh` |

---

## Emergency Reset

**If everything is broken:**

```bash
# 1. Clean everything
cd extension
rm -rf .output node_modules
bun install

cd ../server
cargo clean

# 2. Rebuild from scratch
cd ../extension
bun run build

cd ../server
cargo build --release

# 3. Reinstall NMH
cd ..
./scripts/install-nmh.sh

# 4. Verify
./scripts/verify-installation.sh

# 5. Remove and re-add extension in Chrome
# chrome://extensions → Remove → Load unpacked
```

**If extension ID is wrong:**

```bash
# DON'T regenerate keys! Instead:

# 1. Check key files exist
ls -la extension/private_key.pem extension/public_key.b64

# 2. Rebuild extension
cd extension
rm -rf .output
bun run build

# 3. Check manifest has key
grep '"key"' .output/chrome-mv3/manifest.json

# 4. Compute ID
node ../scripts/compute-extension-id.js

# 5. Reinstall NMH with new ID
cd ..
./scripts/install-nmh.sh
```

---

## Summary: Preventing Past Pain

| Past Problem | Solution | Automation |
|-------------|----------|------------|
| **Extension ID drift** | Baked public key in manifest | `wxt.config.ts` hook auto-injects |
| **ID computation errors** | Script computes from key | `scripts/compute-extension-id.js` |
| **NMH manifest wrong location** | Standardized path | `scripts/install-nmh.sh` auto-detects OS |
| **Extension ID mismatch in NMH** | Read from EXTENSION_ID file | `install-nmh.sh` uses computed ID |
| **Server binary not found** | Standardized path `/usr/local/bin` | `install-nmh.sh` copies to correct location |
| **Binary name mismatch** | Hardcoded names | `Cargo.toml` enforces names |
| **Permissions wrong** | Explicit chmod | `install-nmh.sh` sets permissions |
| **Verification failures** | Comprehensive checks | `verify-installation.sh` catches all issues |

**Result:** Zero manual configuration needed after initial setup.
