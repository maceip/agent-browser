<img width="505" height="371" alt="Agent Browser" src="https://github.com/user-attachments/assets/233a0046-3479-45c8-9369-87b71fd03437" />

    mcp-native browser automation
    stealth + performance as primitives

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Agent Browser is an undetectable browser automation platform for agents that want to browse the web. Its designed to be 10x faster than browser-use / playwright. It includes a native messaging host, a rust MCP <> websocket relay and a passkey proxy.

## Quick Start

```bash
git clone https://github.com/maceip/agent-browser.git
cd agent-browser
./scripts/install.sh
```

Load the extension:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/public`

Register MCP server with Claude:
```bash
claude mcp add agent-browser /usr/local/bin/agent-browser-server
```

Test: Ask Claude to navigate to a website and take a screenshot.

See [docs/QUICKSTART.md](docs/QUICKSTART.md) for detailed setup and [docs/install.md](docs/install.md) for manual installation steps.

## Features

- Full-fidelity Chrome automation via MCP protocol
- Smart GDPR and cookie consent modal detection and dismissal
- Secure WebAuthn credential storage with time-bound authorization
- Automatic magic link email verification detection and navigation
- Local LLM inference for automation assistance
- Privacy-first architecture with no telemetry

## Architecture

- Rust MCP server with stdio and TCP interfaces
- WebSocket bridge to Chrome extension on localhost:8085
- Native messaging host for server lifecycle management
- AES-256-GCM encrypted credential storage in `~/.agent-browser/`
- Offscreen document for local LLM inference

See [docs/architecture.md](docs/architecture.md) for diagrams and detailed component information, or [docs/runtime.md](docs/runtime.md) for operational details.

## Configuration

Configure email providers for magic link automation and passkey authorization windows via the extension welcome screen. Configuration options include:

- Email provider settings for IMAP/OAuth access
- Authorization window duration (default: 5 minutes)
- MCP endpoint selection (stdio or TCP on localhost:8084)
- Automation mode preferences and delays

See [docs/email-provider.md](docs/email-provider.md) and [docs/passkey-authorization.md](docs/passkey-authorization.md) for configuration details.

## Documentation

- [docs/QUICKSTART.md](docs/QUICKSTART.md) - Installation and setup guide
- [docs/architecture.md](docs/architecture.md) - System architecture and data flow diagrams
- [docs/install.md](docs/install.md) - Manual installation steps
- [docs/runtime.md](docs/runtime.md) - Runtime operations and configuration
- [docs/email-provider.md](docs/email-provider.md) - Email configuration
- [docs/passkey-authorization.md](docs/passkey-authorization.md) - Credential management
- [docs/troubleshooting.md](docs/troubleshooting.md) - Common issues and solutions

## Security

Agent Browser prioritizes security and privacy:

- All processing happens locally with no telemetry
- Credentials encrypted at rest with AES-256-GCM
- Time-bound authorization for credential access
- Comprehensive audit logging of all credential operations
- No external dependencies except model downloads

See [SECURITY.md](SECURITY.md) for security policy, threat model, and vulnerability reporting.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Reporting bugs and requesting features
- Development setup and workflow
- Code style and testing requirements
- Pull request process

Security vulnerabilities should be reported privately to security@maceip.com rather than filing public issues.

## License

MIT License. See [LICENSE](LICENSE) for details.

## Project Status

Version 0.1.0 in active development. See [CHANGELOG.md](CHANGELOG.md) for version history.
