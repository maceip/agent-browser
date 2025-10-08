```
     ███        ████ ██████  ████▄    █ ████████
    █████▄     ██▒ ▀█▒██   ▀  ██ ▀█   █ █  ██▒ █▒
    ▓██  ▀█▄  ▓██░▄▄▄░▓███   ███  ▀█ ██▒▓ ███░ ▒░
    ▒██▄▄▄▄██ ▒██  ███▒██  ▄ ███▒  ▐▌██▒▒ ███▓ ░
     ██   ███▒░▒████▀▒░▒████▒▒██░   ███░  ▒██▒ ░
     ▒▒   ▒▒█░ ░▒   ▒ ░░ ▒░ ░░ ▒░   ▒ ▒   ▒ ░░
      ░   ░▒ ░  ░   ░  ░ ░  ░░ ░░   ░ ░░    ░
      ░   ░   ░ ░   ░    ░      ░   ░ ░   ░
          ░  ░      ░    ░  ░         ░

   ░░░░    ░░░░░░   ░░░░░   ░     ░░  ░░░░░░ ░░░░░  ░░░░░░
  ░░░░░░░ ░░░ ░ ░░░░░░░  ░░░░░ ░ ░░░░░░    ░ ░░   ░ ░░░ ░ ░░░
  ░░░░ ░░░░░░ ░░░ ░░░░░  ░░░░░ ░ ░░ ░ ░░░░   ░░░░   ░░░ ░░░ ░
  ░░░░░░  ░░░░░░░  ░░░   ░░░░░ ░ ░░   ░   ░░░░░░  ░ ░░░░░░░
  ░░░  ░░░░░░░ ░░░░░ ░░░░░░░░░░░░░░░░░ ░░░░░░░░░░░░░░░░░ ░░░░░
  ░░░░░░░░░ ░░ ░░░░░░ ░░░░░░░ ░ ░░░ ░  ░ ░░░ ░ ░░░ ░░ ░░ ░░ ░░░░░
  ░░░   ░   ░░ ░ ░░  ░ ░ ░░   ░ ░ ░  ░ ░░  ░ ░ ░ ░  ░  ░░ ░ ░░
   ░    ░   ░░   ░ ░ ░ ░ ░    ░   ░  ░  ░  ░     ░     ░░   ░
   ░         ░         ░ ░      ░          ░     ░  ░   ░
        ░
```

**mcp-native browser automation, with stealth and performance as primitives**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quickstart

```bash
# 1. Install components
./install.sh

# 2. Load extension
# Open chrome://extensions/ → Enable "Developer mode" → "Load unpacked" → Select extension/public

# 3. Configure email provider & passkey authorization
# Click extension icon → Configure email provider for magic link automation
# Set passkey authorization window (default: 5 minutes) for time-bound credential access

# 4. Add MCP server to Claude Code
claude mcp add agent-browser /usr/local/bin/agent-browser-server --env MCP_STDIO=1

# 5. Test it
# Ask Claude: "Navigate to example.com and take a screenshot"
```

Launch Chrome with extension pre-loaded: `./launch-browser.sh`

## Features

### 1. Rust WebSocket Server & Passkey Storage
- High-performance Rust MCP server bridges stdio/TCP to WebSocket
- Secure local passkey credential storage with time-bound authorization
- Native Messaging Host ensures server availability

### 2. Advanced Login/Signup Automation
- **Magic link detection & automation**: Detects verification emails, extracts links, auto-navigates
- **Errant modal detection & dismissal**: AI-powered detection of popups, cookie notices, subscription prompts
- **Passkey proxy with time-bound auth**: Temporary authorization windows for credential access
- Human-like delays and behavior patterns for stealth operation

### 3. Secure Passkey Proxy
- WebAuthn passkey proxying through Chrome extension
- Time-bound authorization system (configurable expiry)
- Encrypted credential storage in Rust server
- Zero remote dependencies for credential handling

### 4. Local LLM Serving
- Offscreen document hosts local LLM inference
- Evolving detection and evasion strategies
- Privacy-first: all processing happens locally
- Configurable model loading (customizable endpoints)

### 5. Privacy & Security
- All local processing, no telemetry
- No remote dependencies except configurable model loading
- Open source, auditable codebase
- MIT licensed

## License

MIT License - see LICENSE file for details
