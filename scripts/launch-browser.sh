#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================"
echo "Agent Browser - Launch Helper"
echo "======================================${NC}"
echo

# Configuration
PROFILE_DIR="$HOME/.chrome-profiles/agent-browser-dev"
EXTENSION_DIR="$(pwd)/extension/public"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  CHROME_CANARY="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
  CHROME_DEV="/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev"
  CHROME_BETA="/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta"
  CHROME_STABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CHROME_CANARY="google-chrome-canary"
  CHROME_DEV="google-chrome-dev"
  CHROME_BETA="google-chrome-beta"
  CHROME_STABLE="google-chrome"
else
  echo -e "${RED}❌ Unsupported OS: $OSTYPE${NC}"
  exit 1
fi

# Find available Chrome
CHROME_BINARY=""
CHROME_NAME=""

if [ -f "$CHROME_CANARY" ] || command -v google-chrome-canary &> /dev/null; then
  CHROME_BINARY="$CHROME_CANARY"
  CHROME_NAME="Chrome Canary"
elif [ -f "$CHROME_DEV" ] || command -v google-chrome-dev &> /dev/null; then
  CHROME_BINARY="$CHROME_DEV"
  CHROME_NAME="Chrome Dev"
elif [ -f "$CHROME_BETA" ] || command -v google-chrome-beta &> /dev/null; then
  CHROME_BINARY="$CHROME_BETA"
  CHROME_NAME="Chrome Beta"
elif [ -f "$CHROME_STABLE" ] || command -v google-chrome &> /dev/null; then
  CHROME_BINARY="$CHROME_STABLE"
  CHROME_NAME="Chrome"
else
  echo -e "${RED}❌ No Chrome installation found${NC}"
  exit 1
fi

echo -e "${GREEN}Using: $CHROME_NAME${NC}"
echo -e "${GREEN}Profile: $PROFILE_DIR${NC}"
echo

# Create profile directory if it doesn't exist
mkdir -p "$PROFILE_DIR"

# Check if extension is built
if [ ! -f "$EXTENSION_DIR/manifest.json" ]; then
  echo -e "${YELLOW}⚠ Extension not built. Building now...${NC}"
  cd extension
  bun install --silent
  bun run build
  cd ..
  echo -e "${GREEN}✓ Extension built${NC}"
  echo
fi

# Launch Chrome with profile and extension
echo -e "${YELLOW}Launching $CHROME_NAME...${NC}"
echo

if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  open -a "$CHROME_BINARY" --args \
    --user-data-dir="$PROFILE_DIR" \
    --profile-directory="Default" \
    --no-first-run \
    --no-default-browser-check \
    --load-extension="$EXTENSION_DIR"
else
  # Linux
  "$CHROME_BINARY" \
    --user-data-dir="$PROFILE_DIR" \
    --profile-directory="Default" \
    --no-first-run \
    --no-default-browser-check \
    --load-extension="$EXTENSION_DIR" &
fi

echo -e "${GREEN}✓ Browser launched with Agent Browser extension${NC}"
echo
echo "The extension should:"
echo "  1. Auto-start the server via NMH"
echo "  2. Connect to WebSocket (localhost:8085)"
echo "  3. Show ✓ badge when ready"
echo
echo "To test MCP connection:"
echo "  nc localhost 8084"
echo '  {"jsonrpc":"2.0","id":1,"method":"tools/list"}'
echo
