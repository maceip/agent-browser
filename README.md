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

## Overview

Agent Browser pairs a Rust MCP server with a Chrome extension and native messaging host to drive full-fidelity browser automation from Claude. The Rust server exposes automation and passkey tooling over MCP (stdio or TCP) while the extension handles in-browser actions, local LLM inference, and UX surface. Native messaging keeps the server alive whenever Chrome is running, and helper scripts manage installation plus launch flows so the toolchain behaves like a single application.

## Prerequisites

- macOS 13+ or Linux with Google Chrome (Stable, Beta, Dev, or Canary) installed
- Rust toolchain with `cargo`, Bun, and Node.js 18+ available on `PATH`
- Anthropic Claude CLI (`claude`) for MCP registration
- `sudo` access to write `/usr/local/bin` and create Chrome native-messaging manifests
- (Optional) `nc` or similar for quick MCP connectivity tests

If you need finer-grained setup steps or a manual install path, see `docs/install.md`.

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

What `./install.sh` does:
- Builds the Rust server and native messaging shim in release mode
- Installs binaries to `/usr/local/bin` (requires `sudo`)
- Computes the Chrome extension ID and writes native messaging manifests for each installed Chrome channel
- Installs JavaScript dependencies with Bun and builds the extension bundle
- Guides you through loading the unpacked extension (`extension/public`)

For change control or air-gapped environments, follow the manual steps in `docs/install.md`.

## Configure Automation

- Email provider & magic link automation: see `docs/email-provider.md`
- Passkey authorization windows, storage, and lifecycle: see `docs/passkey-authorization.md`

The welcome screen inside the extension surfaces these settings, but the docs capture defaults, sample values, and CLI-equivalent commands.

## Runtime & Operations

- MCP endpoints: TCP on `localhost:8084` (set `MCP_TCP=1`) and stdio when launched via Claude (`MCP_STDIO=1`)
- WebSocket bridge for the extension listens on `localhost:8085`
- Passkey vault, audit log, and master key live in `~/.agent-browser/`
- Chrome storage (per profile) retains email provider and automation preferences
- `./verify-install.sh` runs post-install health checks, and `./launch-browser.sh` opens Chrome with an isolated profile plus the extension pre-loaded

Deeper reference material (environment variables, storage layout, log locations, and recommended observability hooks) is in `docs/runtime.md`, while `docs/troubleshooting.md` captures known issues and verification flows.

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

## Contributing & Support

- Issues & feature requests: open a GitHub issue or discussion
- Pull requests welcome—start by outlining proposed changes and include tests or repro steps where possible
- Security reports: disclose privately via the maintainers before filing a public issue
- Project status: actively developed; see `docs/troubleshooting.md` for current known gaps and workarounds
