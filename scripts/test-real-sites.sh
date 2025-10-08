#!/bin/bash
# Test agent-browser on DuckDuckGo AI Chat

set -e

echo "=== Testing agent-browser on DuckDuckGo AI Chat ==="
echo ""

echo "Navigating to DuckDuckGo AI Chat..."
echo '{"jsonrpc":"2.0","id":1,"method":"navigate","params":{"url":"https://duckduckgo.com/?q=DuckDuckGo+AI+Chat&ia=chat&duckai=1"}}' | nc localhost 8084
echo ""

echo "Waiting for chat interface to load..."
sleep 3
echo '{"jsonrpc":"2.0","id":2,"method":"wait","params":{"type":"selector","selector":"textarea[placeholder*=\"Ask\"]"}}' | nc localhost 8084
echo ""

echo "Waiting a moment for any modals to appear..."
sleep 2
echo "Attempting to dismiss any modals (will continue if none found)..."
# Try common modal close selectors - ignore errors if not found
echo '{"jsonrpc":"2.0","id":3,"method":"click","params":{"selector":"button[aria-label*=\"Close\"], button[aria-label*=\"Dismiss\"], .modal-close, [class*=\"close\"][class*=\"button\"], [role=\"dialog\"] button"}}' | nc localhost 8084 2>/dev/null || echo "No modal found, continuing..."
sleep 1
echo ""

echo "Clicking on the text box..."
echo '{"jsonrpc":"2.0","id":5,"method":"click","params":{"selector":"textarea[placeholder*=\"Ask\"]"}}' | nc localhost 8084
echo ""

echo "Typing question..."
echo '{"jsonrpc":"2.0","id":6,"method":"type","params":{"selector":"textarea[placeholder*=\"Ask\"]","text":"What is the weather like today?"}}' | nc localhost 8084
echo ""

echo "Pressing Enter to submit..."
# Simulate pressing Enter key
echo '{"jsonrpc":"2.0","id":7,"method":"type","params":{"selector":"textarea[placeholder*=\"Ask\"]","text":"\n"}}' | nc localhost 8084
echo ""

echo "✓ DuckDuckGo AI Chat test complete"
echo ""

echo "=== Test complete! ==="
