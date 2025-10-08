# Quick Start Guide

Get Agent Browser running in 5 minutes.

## 1. Install Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install Node.js
# Download from https://nodejs.org/ or use your package manager
```

## 2. Clone and Install

```bash
git clone https://github.com/maceip/agent-browser.git
cd agent-browser
./scripts/install.sh
```

Wait for the installer to complete. It will show you the extension folder path.

## 3. Load Extension

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top-right)
4. Click **Load unpacked**
5. Select the folder from step 2 (usually `agent-browser/extension/public`)

Look for the extension badge:
- `⋯` → Starting...
- `✓` → **Ready!**

## 4. Configure Claude

### For Claude Code (Recommended)

Use the CLI - one command:

```bash
claude mcp add agent-browser /usr/local/bin/agent-browser-server --env MCP_STDIO=1
```

Done! The server is immediately available.

### For Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-browser": {
      "command": "/usr/local/bin/agent-browser-server",
      "env": {
        "MCP_STDIO": "1"
      }
    }
  }
}
```

**Restart Claude Desktop** after editing.

## 5. Test It

In Claude Desktop or Claude Code, try:

> "Navigate to aol.com and take a screenshot"

You should see:
1. Chrome navigates to aol.com
2. Tab is added to "Agent Browser" group (blue)
3. Extension badge shows `→` (navigating) then `📷` (screenshot)
4. Screenshot is returned to Claude as an image

Other things to try:
- "Navigate to google.com"
- "Click the search button"
- "Type 'hello world' into the search box"
- "Wait for the page to load"

## That's It!

For more details, see [README.md](README.md).

## Common Issues

**Badge shows ✗**
- Click the extension icon to reconnect

**"No valid tab found"**
- Make sure you're not on `chrome://` pages
- Navigate will create a new tab automatically

**Claude Desktop doesn't see the server**
- Restart Claude Desktop after editing config
- Check server is running: `ps aux | grep agent-browser-server`
