#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================"
echo "Agent Browser - Easy Install"
echo "======================================${NC}"
echo
echo "This will install Agent Browser for your Chrome profile."
echo

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
  CHROME_NMH_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  CHROME_CANARY_NMH_DIR="$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
  CHROME_DEV_NMH_DIR="$HOME/Library/Application Support/Google/Chrome Dev/NativeMessagingHosts"
  CHROME_BETA_NMH_DIR="$HOME/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OS="linux"
  CHROME_NMH_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
  CHROME_CANARY_NMH_DIR="$HOME/.config/google-chrome-canary/NativeMessagingHosts"
  CHROME_DEV_NMH_DIR="$HOME/.config/google-chrome-dev/NativeMessagingHosts"
  CHROME_BETA_NMH_DIR="$HOME/.config/google-chrome-beta/NativeMessagingHosts"
else
  echo -e "${RED}❌ Unsupported OS: $OSTYPE${NC}"
  exit 1
fi

echo -e "${GREEN}Detected OS: $OS${NC}"
echo

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check for Rust
if ! command -v cargo &> /dev/null; then
  echo -e "${RED}❌ Rust not found. Please install Rust first:${NC}"
  echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
fi
echo -e "${GREEN}✓ Rust found: $(rustc --version)${NC}"

# Check for Bun
if ! command -v bun &> /dev/null; then
  echo -e "${RED}❌ Bun not found. Please install Bun first:${NC}"
  echo "   curl -fsSL https://bun.sh/install | bash"
  exit 1
fi
echo -e "${GREEN}✓ Bun found: $(bun --version)${NC}"

# Check for Node (for extension ID calculation)
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js not found. Please install Node.js first:${NC}"
  echo "   https://nodejs.org/"
  exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"
echo

# Step 2: Build binaries
echo -e "${YELLOW}Step 2: Building server and NMH binaries...${NC}"
cd server
cargo build --release
cd ..
echo -e "${GREEN}✓ Binaries built${NC}"
echo

# Step 3: Install binaries
echo -e "${YELLOW}Step 3: Installing binaries...${NC}"
echo "This requires sudo access to install to /usr/local/bin/"

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

# Step 4: Compute extension ID
echo -e "${YELLOW}Step 4: Computing extension ID...${NC}"

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
echo "$EXTENSION_ID" > extension/EXTENSION_ID
echo

# Step 5: Install NMH manifests
echo -e "${YELLOW}Step 5: Installing Native Messaging Host manifests...${NC}"

NMH_MANIFEST=$(cat << EOF
{
  "name": "com.agentbrowser.native",
  "description": "Agent Browser Native Messaging Host",
  "path": "/usr/local/bin/agent-browser-nmh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF
)

INSTALLED_COUNT=0

# Install for all Chrome versions
declare -A CHROME_DIRS=(
  ["Chrome"]="$CHROME_NMH_DIR"
  ["Chrome Canary"]="$CHROME_CANARY_NMH_DIR"
  ["Chrome Dev"]="$CHROME_DEV_NMH_DIR"
  ["Chrome Beta"]="$CHROME_BETA_NMH_DIR"
)

for chrome_version in "${!CHROME_DIRS[@]}"; do
  DIR="${CHROME_DIRS[$chrome_version]}"

  # Check if Chrome version exists (check parent directory)
  if [ -d "$(dirname "$DIR")" ]; then
    mkdir -p "$DIR"
    echo "$NMH_MANIFEST" > "$DIR/com.agentbrowser.native.json"
    echo -e "${GREEN}✓ Installed NMH for $chrome_version${NC}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
  fi
done

if [ $INSTALLED_COUNT -eq 0 ]; then
  echo -e "${RED}❌ No Chrome installations found${NC}"
  echo "Please install Chrome and try again."
  exit 1
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

# Step 7: Create installation instructions
EXTENSION_PATH="$(pwd)/extension/public"

echo -e "${GREEN}======================================"
echo "Installation Complete!"
echo "======================================${NC}"
echo
echo -e "${BLUE}Extension ID:${NC} $EXTENSION_ID"
echo
echo -e "${BLUE}NMH installed for:${NC}"
for chrome_version in "${!CHROME_DIRS[@]}"; do
  DIR="${CHROME_DIRS[$chrome_version]}"
  if [ -f "$DIR/com.agentbrowser.native.json" ]; then
    echo "  ✓ $chrome_version"
  fi
done
echo
echo -e "${YELLOW}======================================"
echo "Next Steps - Load Extension in Chrome"
echo "======================================${NC}"
echo
echo "1. Open Chrome/Chrome Canary/Chrome Dev/Chrome Beta"
echo "2. Go to: chrome://extensions/"
echo "3. Enable 'Developer mode' (toggle in top-right)"
echo "4. Click 'Load unpacked'"
echo "5. Select this folder:"
echo "   ${BLUE}$EXTENSION_PATH${NC}"
echo
echo -e "${GREEN}The extension will automatically:${NC}"
echo "  • Start the server via Native Messaging Host"
echo "  • Connect to WebSocket (localhost:8085)"
echo "  • Show badges indicating status"
echo
echo -e "${BLUE}Badge meanings:${NC}"
echo "  ⋯ (yellow)  = Server starting"
echo "  ✓ (green)   = Connected and ready"
echo "  ✗ (red)     = Disconnected"
echo "  → (blue)    = Navigating"
echo "  ⌖ (blue)    = Clicking"
echo "  ⌨ (blue)    = Typing"
echo "  ↻N (yellow) = Reconnecting (attempt N)"
echo "  ⚠ (red)     = Error (hover for details)"
echo
echo -e "${BLUE}To test the MCP server:${NC}"
echo "  nc localhost 8084"
echo '  {"jsonrpc":"2.0","id":1,"method":"tools/list"}'
echo
echo -e "${BLUE}For convenience, you can use:${NC}"
echo "  ./launch-browser.sh    # Launch Chrome with extension pre-loaded"
echo
