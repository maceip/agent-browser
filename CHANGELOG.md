# Changelog

All notable changes to Agent Browser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial public release preparation
- MIT LICENSE file
- SECURITY.md with security policy and threat model
- CONTRIBUTING.md with contribution guidelines
- Basic test suite (6 TypeScript tests, 3 Rust tests)
- Comprehensive documentation cleanup

### Changed
- Moved development documentation to external planning directory
- Updated repository URLs to https://github.com/maceip/agent-browser
- Fixed all Rust compiler warnings (0 warnings)
- Improved .gitignore to exclude .DS_Store and extension/key.pem

### Removed
- Development artifacts (.DS_Store files)
- Internal planning documents from repository
- Extension private key from version control

## [0.1.0] - 2025-10-08

### Added
- **Rust WebSocket Server**
  - MCP server with TCP (port 8084) and stdio interfaces
  - WebSocket bridge for Chrome extension (port 8085)
  - Native messaging host for server lifecycle management
  - Automatic server startup when Chrome launches

- **Passkey Credential Storage**
  - AES-256-GCM encrypted credential storage
  - Time-bound authorization system (default 8 hours)
  - Audit logging for all credential operations
  - Secure file permissions (0600) for sensitive data

- **Chrome Extension**
  - Browser automation via MCP protocol
  - WebAuthn passkey proxy for credential management
  - Local LLM inference (Gemma 3N via MediaPipe)
  - Visual status badges and welcome screen

- **Automation Features**
  - Smart GDPR/cookie modal detection and dismissal
  - Magic link email authentication flows
  - Automatic modal handling with safeguards
  - Humanized delays to avoid detection
  - Agent stuck detection with LLM assistance

- **LLM Integration**
  - Offscreen document for local LLM inference
  - Multi-modal LLM queries (text + screenshots)
  - Content script and Rust server query support
  - Streaming response handling

- **Documentation**
  - Quick start guide (5-minute setup)
  - Comprehensive README with architecture overview
  - Feature documentation and examples
  - Installation and troubleshooting guides

### Security
- Local-first architecture (no telemetry)
- Encrypted passkey storage with master key
- Time-bound credential authorization
- Audit logging for compliance
- Secure file permissions for sensitive data

### Technical
- Rust backend with Tokio async runtime
- TypeScript extension with Bun build system
- WebSocket communication layer
- MCP protocol implementation (stdio and TCP)
- Chrome Native Messaging integration

## [0.0.1] - 2025-10-06

### Added
- Initial proof of concept
- Basic MCP server in Rust
- Chrome extension skeleton
- WebSocket bridge prototype

---

## Release Notes

### v0.1.0 - First Public Release

This is the first public release of Agent Browser, providing a complete MCP-based browser automation solution with local LLM inference and secure passkey management.

**Key Features:**
- Full-fidelity browser automation from Claude
- Secure local passkey credential storage
- Local LLM for automation assistance
- Smart GDPR/modal handling
- Magic link authentication flows

**Installation:**
```bash
git clone https://github.com/maceip/agent-browser.git
cd agent-browser
./install.sh
```

**Requirements:**
- macOS 13+ or Linux
- Rust, Bun, Node.js 18+
- Google Chrome (any channel)
- Claude CLI for MCP registration

**Known Limitations:**
- Extension must be loaded in developer mode
- No Touch ID integration yet
- Master key stored on disk (no keychain integration)
- Basic test coverage

**Next Steps:**
- OS keychain integration
- Touch ID / biometric authentication
- Chrome Web Store publication
- Expanded test coverage

---

[Unreleased]: https://github.com/maceip/agent-browser/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/maceip/agent-browser/releases/tag/v0.1.0
[0.0.1]: https://github.com/maceip/agent-browser/releases/tag/v0.0.1
