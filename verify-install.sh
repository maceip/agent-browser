#!/bin/bash

echo "======================================"
echo "Agent Browser Installation Verification"
echo "======================================"
echo

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# Check 1: Extension key exists
echo -n "Checking extension key... "
if [ -f extension/key.pem ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC} (extension/key.pem not found)"
  FAILED=1
fi

# Check 2: Extension ID file exists
echo -n "Checking extension ID... "
if [ -f extension/EXTENSION_ID ]; then
  EXTENSION_ID=$(cat extension/EXTENSION_ID)
  echo -e "${GREEN}✓${NC} ($EXTENSION_ID)"
else
  echo -e "${RED}✗${NC} (extension/EXTENSION_ID not found)"
  FAILED=1
fi

# Check 3: Server binary built
echo -n "Checking server binary... "
if [ -f server/target/release/agent-browser-server ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC} (server/target/release/agent-browser-server not found)"
  FAILED=1
fi

# Check 4: NMH binary built
echo -n "Checking NMH binary... "
if [ -f server/target/release/nmh_shim ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC} (server/target/release/nmh_shim not found)"
  FAILED=1
fi

# Check 5: Server binary installed
echo -n "Checking server installation... "
if [ -f /usr/local/bin/agent-browser-server ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC} (/usr/local/bin/agent-browser-server not found)"
  FAILED=1
fi

# Check 6: NMH binary installed
echo -n "Checking NMH installation... "
if [ -f /usr/local/bin/agent-browser-nmh ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC} (/usr/local/bin/agent-browser-nmh not found)"
  FAILED=1
fi

# Check 7: NMH manifests installed
echo
echo "Checking NMH manifests:"
CHROME_VERSIONS=("Chrome" "Chrome Canary" "Chrome Dev" "Chrome Beta")
MANIFEST_COUNT=0

for chrome_version in "${CHROME_VERSIONS[@]}"; do
  NMH_MANIFEST="$HOME/Library/Application Support/Google/$chrome_version/NativeMessagingHosts/com.agentbrowser.native.json"

  echo -n "  $chrome_version... "
  if [ -f "$NMH_MANIFEST" ]; then
    echo -e "${GREEN}✓${NC}"
    MANIFEST_COUNT=$((MANIFEST_COUNT + 1))
  else
    echo -e "${YELLOW}⚠ not installed${NC}"
  fi
done

if [ $MANIFEST_COUNT -eq 0 ]; then
  echo -e "${RED}✗ No NMH manifests found in any Chrome version${NC}"
  FAILED=1
fi

# Check 8: Extension built
echo
echo -n "Checking extension build... "
if [ -f extension/public/background.js ] && [ -f extension/public/content.js ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC} (extension not built)"
  FAILED=1
fi

# Check 9: WebSocket port available
echo -n "Checking port 8085 (WebSocket)... "
if lsof -Pi :8085 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} (server is running)"
else
  echo -e "${YELLOW}⚠${NC} (server not running - this is OK if you haven't loaded the extension yet)"
fi

# Check 10: MCP TCP port available
echo -n "Checking port 8084 (MCP)... "
if lsof -Pi :8084 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} (server is running)"
else
  echo -e "${YELLOW}⚠${NC} (server not running - this is OK if you haven't loaded the extension yet)"
fi

echo
echo "======================================"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All checks passed!${NC}"
  echo
  echo "Next steps:"
  echo "1. Open Chrome and go to chrome://extensions/"
  echo "2. Enable 'Developer mode'"
  echo "3. Click 'Load unpacked'"
  echo "4. Select: $(pwd)/extension/public"
  echo
  echo "The extension should show a green ✓ badge when connected."
else
  echo -e "${RED}Some checks failed!${NC}"
  echo
  echo "To fix:"
  echo "  bun run install-nmh"
fi

echo "======================================"
echo
