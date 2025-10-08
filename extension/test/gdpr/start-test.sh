#!/bin/bash

# GDPR Test Suite Quick Start Script

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     GDPR Auto-Modal Detection Test Suite                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if extension is built
if [ ! -f "../../public/content.js" ]; then
    echo "❌ Extension not built!"
    echo ""
    echo "Building extension..."
    cd ../../.. && bun run --cwd extension build && cd extension/test/gdpr
    echo "✅ Extension built!"
    echo ""
fi

echo "🚀 Starting GDPR test server on http://localhost:3500"
echo ""
echo "📋 Test Steps:"
echo "   1. Server will start with HMR enabled"
echo "   2. Open http://localhost:3500 in Chrome with extension"
echo "   3. Watch GDPR banner appear (no cookies)"
echo "   4. Auto-modal detects and clicks 'Accept All'"
echo "   5. Navigate to /story page"
echo "   6. Banner does NOT appear (cookies exist)"
echo "   7. Check debug console (top-right) for status"
echo ""
echo "🔧 Quick Actions:"
echo "   • Reset test: Click 'Clear Cookies' in nav"
echo "   • View logs: Check browser DevTools console"
echo "   • Stop server: Press Ctrl+C"
echo ""
echo "Starting server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

bun run dev
