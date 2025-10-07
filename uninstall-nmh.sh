#!/bin/bash
set -e

echo "======================================"
echo "Agent Browser NMH Uninstall Script"
echo "======================================"
echo

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OS="linux"
else
  echo -e "${RED}❌ Unsupported OS: $OSTYPE${NC}"
  exit 1
fi

echo -e "${GREEN}Detected OS: $OS${NC}"
echo

# Step 1: Remove binaries
echo -e "${YELLOW}Step 1: Removing binaries...${NC}"

if [ -f /usr/local/bin/agent-browser-server ]; then
  sudo rm /usr/local/bin/agent-browser-server
  echo -e "${GREEN}✓ Removed agent-browser-server${NC}"
else
  echo -e "${YELLOW}⚠ agent-browser-server not found${NC}"
fi

if [ -f /usr/local/bin/agent-browser-nmh ]; then
  sudo rm /usr/local/bin/agent-browser-nmh
  echo -e "${GREEN}✓ Removed agent-browser-nmh${NC}"
else
  echo -e "${YELLOW}⚠ agent-browser-nmh not found${NC}"
fi

echo

# Step 2: Remove NMH manifests from all Chrome versions
echo -e "${YELLOW}Step 2: Removing NMH manifests...${NC}"

CHROME_VERSIONS=("Chrome" "Chrome Canary" "Chrome Dev" "Chrome Beta" "Chrome for Testing")
REMOVED_COUNT=0

for chrome_version in "${CHROME_VERSIONS[@]}"; do
  NMH_MANIFEST="$HOME/Library/Application Support/Google/$chrome_version/NativeMessagingHosts/com.agentbrowser.native.json"

  if [ -f "$NMH_MANIFEST" ]; then
    rm "$NMH_MANIFEST"
    echo -e "${GREEN}✓ Removed from $chrome_version${NC}"
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
  fi
done

if [ $REMOVED_COUNT -eq 0 ]; then
  echo -e "${YELLOW}⚠ No NMH manifests found${NC}"
fi

echo

# Step 3: Clean up extension artifacts (optional)
echo -e "${YELLOW}Step 3: Cleaning extension artifacts...${NC}"

if [ -f extension/EXTENSION_ID ]; then
  rm extension/EXTENSION_ID
  echo -e "${GREEN}✓ Removed extension/EXTENSION_ID${NC}"
fi

echo

echo -e "${GREEN}======================================"
echo "Uninstall Complete!"
echo "======================================${NC}"
echo
echo "To complete removal:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Remove the Agent Browser extension"
echo "3. Restart Chrome"
echo
