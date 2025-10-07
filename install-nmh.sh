#!/bin/bash
set -e

echo "======================================"
echo "Agent Browser NMH Installation Script"
echo "======================================"
echo

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS and set paths
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
  NMH_DIR="$HOME/.chrome-profiles/agent-browser-dev/NativeMessagingHosts"
  CHROME_CANARY_DIR="$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OS="linux"
  NMH_DIR="$HOME/.chrome-profiles/agent-browser-dev/NativeMessagingHosts"
  CHROME_CANARY_DIR="$HOME/.config/google-chrome-beta/NativeMessagingHosts"
else
  echo -e "${RED}❌ Unsupported OS: $OSTYPE${NC}"
  exit 1
fi

echo -e "${GREEN}Detected OS: $OS${NC}"
echo

# Step 1: Build binaries
echo -e "${YELLOW}Step 1: Building server and NMH binaries...${NC}"
cd server
cargo build --release
cd ..
echo -e "${GREEN}✓ Binaries built${NC}"
echo

# Step 2: Install binaries
echo -e "${YELLOW}Step 2: Installing binaries...${NC}"
# Install main server binary
sudo cp server/target/release/agent-browser-server /usr/local/bin/agent-browser-server
sudo chmod +x /usr/local/bin/agent-browser-server

# Install NMH binary
sudo cp server/target/release/nmh_shim /usr/local/bin/agent-browser-nmh
sudo chmod +x /usr/local/bin/agent-browser-nmh

echo -e "${GREEN}✓ Binaries installed to /usr/local/bin/${NC}"
echo "  - agent-browser-server"
echo "  - agent-browser-nmh"
echo

# Step 3: Compute extension ID from public key
echo -e "${YELLOW}Step 3: Computing extension ID...${NC}"

# Use Node.js to compute extension ID (Chrome's algorithm: first 16 bytes, both nibbles)
EXTENSION_ID=$(node -e "
const crypto = require('crypto');
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('./extension/public/manifest.json', 'utf8'));
const pubKeyBase64 = manifest.key;
const pubKeyDER = Buffer.from(pubKeyBase64, 'base64');
const hash = crypto.createHash('sha256').update(pubKeyDER).digest();
const extensionId = Array.from(hash.slice(0, 16))
  .map(b => String.fromCharCode(97 + ((b >> 4) & 0x0f)) + String.fromCharCode(97 + (b & 0x0f)))
  .join('');
console.log(extensionId);
")

echo -e "${GREEN}Extension ID: $EXTENSION_ID${NC}"
echo

# Save extension ID for future reference
echo "$EXTENSION_ID" > extension/EXTENSION_ID
echo -e "${GREEN}✓ Saved to extension/EXTENSION_ID${NC}"
echo

# Step 4: Create NMH manifest for Chrome
echo -e "${YELLOW}Step 4: Creating NMH manifest for Chrome...${NC}"
mkdir -p "$NMH_DIR"

cat > "$NMH_DIR/com.agentbrowser.native.json" << EOF
{
  "name": "com.agentbrowser.native",
  "description": "Agent Browser Native Messaging Host",
  "path": "/usr/local/bin/agent-browser-nmh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/",
    "chrome-extension://jephebfdidlihjhgghkkffaaihnhidfj/"
  ]
}
EOF

echo -e "${GREEN}✓ NMH manifest created at:${NC}"
echo "  $NMH_DIR/com.agentbrowser.native.json"
echo

# Step 5: Install for other Chrome versions
echo -e "${YELLOW}Step 5: Installing for other Chrome versions...${NC}"

CHROME_VERSIONS=("Chrome Canary" "Chrome Dev" "Chrome Beta")
INSTALLED_COUNT=0

for chrome_version in "${CHROME_VERSIONS[@]}"; do
  CHROME_NMH_DIR="$HOME/Library/Application Support/Google/$chrome_version/NativeMessagingHosts"

  if [ -d "$(dirname "$CHROME_NMH_DIR")" ]; then
    mkdir -p "$CHROME_NMH_DIR"
    cp "$NMH_DIR/com.agentbrowser.native.json" "$CHROME_NMH_DIR/com.agentbrowser.native.json"
    echo -e "${GREEN}✓ Installed to $chrome_version${NC}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
  fi
done

if [ $INSTALLED_COUNT -eq 0 ]; then
  echo -e "${YELLOW}⚠ No additional Chrome versions found${NC}"
fi
echo

# Step 6: Build extension
echo -e "${YELLOW}Step 6: Building extension...${NC}"
cd extension
bun install --silent
bun run build
cd ..
echo -e "${GREEN}✓ Extension built${NC}"
echo

echo -e "${GREEN}======================================"
echo "Installation Complete!"
echo "======================================${NC}"
echo
echo "Extension ID: $EXTENSION_ID"
echo
echo "NMH manifest installed in:"
ALL_CHROME_VERSIONS=("Chrome" "Chrome Canary" "Chrome Dev" "Chrome Beta")
for chrome_version in "${ALL_CHROME_VERSIONS[@]}"; do
  CHROME_NMH_DIR="$HOME/Library/Application Support/Google/$chrome_version/NativeMessagingHosts"
  if [ -f "$CHROME_NMH_DIR/com.agentbrowser.native.json" ]; then
    echo "  ✓ $chrome_version"
  fi
done
echo
echo "Next steps:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode'"
echo "3. Click 'Load unpacked'"
echo "4. Select: $(pwd)/extension/public"
echo
echo "The extension will automatically:"
echo "  - Call NMH to start the server"
echo "  - Connect to WebSocket on localhost:8085"
echo "  - Show ✓ badge when connected"
echo
echo "To test MCP:"
echo "  nc localhost 8084"
echo '  {"jsonrpc":"2.0","id":1,"method":"navigate","params":{"url":"https://example.com"}}'
echo
