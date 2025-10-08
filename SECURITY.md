# Security Policy

## Reporting Security Issues

If you discover a security vulnerability in Agent Browser, please report it responsibly:

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, please email security reports to: **security@maceip.com** (or create a private security advisory on GitHub)

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

We will acknowledge your email within 48 hours and provide a more detailed response within 7 days.

## Security Features

Agent Browser implements several security measures:

### 1. Encrypted Credential Storage
- **AES-256-GCM encryption** for passkey credentials at rest
- Master encryption key stored with `0600` permissions (owner-only read/write)
- Encrypted credentials stored in `~/.agent-browser/credentials.json`

### 2. Time-Bound Authorization
- Credentials require explicit authorization with time limits
- Default authorization window: 8 hours
- Authorization can be revoked at any time
- All credential operations are audit logged

### 3. Audit Logging
- All credential access logged to `~/.agent-browser/audit.log`
- Timestamps, operation types, and credential IDs recorded
- Log file secured with `0600` permissions

### 4. Local-First Architecture
- **No telemetry or analytics** sent to external servers
- All processing happens locally on your machine
- Only external dependency: LLM model download from Hugging Face (optional)

### 5. Extension Permissions
- Chrome extension requests minimal required permissions
- `<all_urls>` permission needed for automation (by design)
- `nativeMessaging` permission for server communication
- `webNavigation` permission for navigation tracking

### 6. Secure File Permissions

All sensitive files use Unix permissions:
```
~/.agent-browser/
├── master.key          (0600 - owner read/write only)
├── credentials.json    (0600 - owner read/write only)
└── audit.log          (0600 - owner read/write only)
```

## Known Limitations

We acknowledge these current limitations:

### 1. Master Key Storage
- **Current:** Master encryption key stored on disk
- **Future:** OS keychain integration (macOS Keychain, Linux Secret Service)
- **Mitigation:** File permissions restrict access to owner only

### 2. Touch ID / Biometric Auth
- **Current:** Time-bound authorization without biometric verification
- **Future:** Touch ID on macOS, biometric on Linux
- **Mitigation:** Require explicit authorization with time limits

### 3. Memory Protection
- **Current:** Basic memory handling in Rust
- **Future:** Memory locking for sensitive data (mlock/VirtualLock)
- **Mitigation:** Rust's memory safety prevents common vulnerabilities

### 4. Extension Signing
- **Current:** Unsigned extension in development mode
- **Future:** Publish to Chrome Web Store with signed extension
- **Mitigation:** Users must manually verify source before loading

## Security Best Practices

When using Agent Browser:

### For Users

1. **Verify Source**
   - Clone from official repository only: https://github.com/maceip/agent-browser
   - Verify git commit signatures if available
   - Review code before building from source

2. **Secure Your Machine**
   - Use full disk encryption
   - Enable screen lock with timeout
   - Keep OS and Chrome updated
   - Use strong user account password

3. **Authorization Management**
   - Use shortest authorization window needed
   - Revoke authorization when not in use
   - Review audit logs periodically

4. **Credential Hygiene**
   - Back up `~/.agent-browser/` securely
   - Use passkeys for sensitive accounts only after testing
   - Keep credentials.json encrypted (never decrypt manually)

### For Developers

1. **Code Review**
   - All PRs require security review for credential/auth changes
   - Test security features thoroughly
   - Never commit secrets or keys

2. **Dependency Management**
   - Keep dependencies updated
   - Review security advisories
   - Use `cargo audit` and `bun audit`

3. **Testing**
   - Write security tests for auth flows
   - Test permission boundaries
   - Verify encryption/decryption

## Threat Model

### In Scope

Agent Browser protects against:

- **Unauthorized credential access** - Encryption prevents reading raw credentials
- **Credential theft** - Time-bound auth limits exposure window
- **Audit trail tampering** - Append-only log with timestamps
- **Memory dumps** - Rust memory safety reduces attack surface

### Out of Scope

Agent Browser does NOT protect against:

- **Compromised OS** - Root access can read master key
- **Browser exploits** - Chrome vulnerabilities can bypass extension
- **Physical access** - Unlocked machine grants full access
- **Malicious extensions** - Other extensions may interfere
- **Network attacks** - Local-only, no network security needed

## Security Updates

We will publish security updates via:

1. **GitHub Security Advisories** - For critical vulnerabilities
2. **Release Notes** - For all security fixes
3. **CHANGELOG.md** - Detailed security patch notes

## Compliance

Agent Browser is designed for:

- Personal use and automation
- Research and development
- Security testing (with permission)

Agent Browser is NOT certified for:

- HIPAA, SOC 2, or other compliance frameworks
- Production use in regulated industries
- Government or military applications

Use at your own risk for sensitive or regulated data.

## Security Roadmap

Planned security enhancements:

- [ ] OS keychain integration (Q1 2025)
- [ ] Touch ID / biometric authentication (Q1 2025)
- [ ] Memory locking for sensitive data (Q2 2025)
- [ ] Extension signing and Web Store publication (Q2 2025)
- [ ] Hardware security key support (Q3 2025)

## Contact

Security questions: **security@maceip.com**

General questions: Open a GitHub issue or discussion

## Attribution

We thank security researchers who responsibly disclose vulnerabilities.

Acknowledged researchers:
- (None yet - be the first!)

---

Last updated: 2025-10-08
