<img width="505" height="371" alt="macmacmacprime_httpss mj run6JSufMtx_U4_logo_for_browser_auto_e94203ad-baa2-44c0-b14d-17e2aa0b1ac2_2" src="https://github.com/user-attachments/assets/233a0046-3479-45c8-9369-87b71fd03437" />

    mcp-native browser automation
    stealth + performance as primitives

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Agent Browser is an undetectable browser automation platform for agents that want to browse the web. Its designed to be 10x faster than browser-use / playwright. It includes a native messaging host, a rust MCP <> websocket relay and a passkey proxy.

## Features

- **Playwright-compatible tools** - Drop-in replacement for common Playwright MCP commands
- **Native Chrome extension** - No external browser process, always available
- **Persistent automation** - Survives content script reloads and Chrome lifecycle events
- **MCP protocol compliant** - Works with Claude Desktop, mcp CLI, and other MCP clients
- **Stealth automation** - Human-like delays and behavior patterns

## Installation

### Prerequisites

- Rust 1.70 or higher
- Chrome or Chrome Canary
- macOS (Linux and Windows support coming soon)

### Build from Source

1. Clone the repository:
```bash
git clone https://github.com/yourusername/agent-browser.git
cd agent-browser
```

2. Build the server and extension:
```bash
cd server
cargo build --release

cd ../extension
bun install
bun run build
```

3. Install the Native Messaging Host:
```bash
./install-nmh.sh
```

4. Load the extension in Chrome:
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `agent-browser/extension/public`

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "agent-browser": {
      "command": "/usr/local/bin/agent-browser-server",
      "env": {
        "MCP_TCP": "1"
      }
    }
  }
}
```

### MCP CLI

```bash
mcp install agent-browser --command /usr/local/bin/agent-browser-server
```

## Available Tools

### playwright_navigate

Navigate to a URL in the browser.

```json
{
  "name": "playwright_navigate",
  "arguments": {
    "url": "https://example.com"
  }
}
```

### playwright_click

Click an element on the page.

```json
{
  "name": "playwright_click",
  "arguments": {
    "selector": "button.submit"
  }
}
```

### playwright_fill

Fill out an input field.

```json
{
  "name": "playwright_fill",
  "arguments": {
    "selector": "input[name='email']",
    "value": "user@example.com"
  }
}
```

### playwright_screenshot

Take a screenshot of the current page.

```json
{
  "name": "playwright_screenshot",
  "arguments": {}
}
```

Returns base64-encoded PNG image data.

## Architecture

Agent Browser consists of three components:

1. **Rust Server** - MCP server that bridges TCP/stdio to WebSocket
2. **Chrome Extension** - Background service worker and content scripts
3. **Native Messaging Host** - Shim that ensures the server is running

```
MCP Client → Server (TCP/stdio) → WebSocket → Extension → Browser
```

The extension automatically injects content scripts into pages and maintains WebSocket connection to the server. The Native Messaging Host ensures the server is always available when the extension loads.

## Development

### Project Structure

```
agent-browser/
├── server/                  # Rust MCP server
│   └── src/
│       ├── main.rs         # MCP + WebSocket bridge
│       └── bin/
│           └── nmh_shim.rs # Native messaging host
├── extension/              # Chrome extension
│   ├── entrypoints/
│   │   ├── background.ts   # Service worker
│   │   └── content.ts      # Content script
│   └── lib/automation/     # Automation commands
└── install-nmh.sh          # Installation script
```

### Running Tests

```bash
# Test raw JSON-RPC
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | nc localhost 8084

# Test navigation
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"playwright_navigate","arguments":{"url":"https://example.com"}}}' | nc localhost 8084
```

## Roadmap

- [ ] Windows and Linux support
- [ ] Additional Playwright tools (hover, drag, evaluate)
- [ ] Full-page screenshots
- [ ] Element screenshots
- [ ] Network request interception
- [ ] Cookie management
- [ ] Local storage access

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

Built to simplify browser automation for AI agents. Inspired by Microsoft's Playwright MCP server.
