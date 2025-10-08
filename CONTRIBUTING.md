# Contributing to Agent Browser

Thank you for your interest in contributing to Agent Browser! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other contributors

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

When creating a bug report, include:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Environment details:**
  - OS (macOS version, Linux distro)
  - Chrome version and channel (Stable, Beta, Dev, Canary)
  - Agent Browser version
  - Rust, Bun, Node.js versions

**Example:**
```markdown
### Bug: Extension badge shows ✗ after Chrome restart

**Steps to reproduce:**
1. Start Chrome with extension loaded
2. Close Chrome completely
3. Restart Chrome
4. Extension badge shows ✗ instead of reconnecting

**Expected:** Badge should show ⋯ then ✓ after reconnecting
**Actual:** Badge shows ✗ and requires manual reconnect

**Environment:**
- macOS 14.5
- Chrome 130.0.6723.58 (Stable)
- Agent Browser v0.1.0
```

### Suggesting Features

Feature requests are welcome! Please include:

- **Clear use case** - What problem does this solve?
- **Proposed solution** - How should it work?
- **Alternatives considered** - Other approaches you've thought about
- **Additional context** - Examples, mockups, or references

### Security Vulnerabilities

**DO NOT** open public issues for security vulnerabilities.

Please email security reports to **security@maceip.com** or create a private security advisory.

See [SECURITY.md](SECURITY.md) for details.

## Development Setup

### Prerequisites

Install required tools:

```bash
# macOS
brew install rust bun node

# Linux (Ubuntu/Debian)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
curl -fsSL https://bun.sh/install | bash
# Install Node.js via package manager or nvm
```

### Clone and Build

```bash
git clone https://github.com/maceip/agent-browser.git
cd agent-browser

# Build server and extension
bun run build

# Install to /usr/local/bin (requires sudo)
./install.sh
```

### Project Structure

```
agent-browser/
├── server/              # Rust MCP server
│   ├── src/
│   │   ├── main.rs     # WebSocket server, MCP protocol
│   │   ├── credential_store.rs  # Passkey storage
│   │   ├── mcp/        # MCP JSON-RPC types
│   │   └── bin/        # Native messaging host
│   └── Cargo.toml
├── extension/           # Chrome extension
│   ├── entrypoints/    # Background, content, offscreen scripts
│   ├── lib/            # Automation, LLM, WebAuthn libraries
│   ├── public/         # Extension assets and manifest
│   └── test/           # Test servers and demos
├── LICENSE
├── README.md
└── QUICKSTART.md
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 2. Make Changes

Follow these guidelines:

**Code Style:**
- Rust: Use `cargo fmt` and `cargo clippy`
- TypeScript: Use Bun's formatter
- Maximum line length: 100 characters
- Use clear, descriptive variable names

**Commit Messages:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, no code change
- `refactor`: Code restructuring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(automation): add smart GDPR modal detection

Implements first-visit detection using document.cookie check.
Only attempts modal dismissal when no cookies exist for origin.

Closes #123

fix(server): resolve WebSocket connection timeout

Increased connection timeout from 5s to 30s to handle
slow network conditions.

Fixes #456
```

### 3. Test Your Changes

**Run tests:**
```bash
# TypeScript tests
cd extension/test && bun test

# Rust tests
cd server && cargo test

# Build check
bun run build
```

**Manual testing:**
1. Load unpacked extension in Chrome
2. Test affected functionality
3. Check console for errors
4. Verify no regressions

### 4. Submit Pull Request

**Before submitting:**
- [ ] Code builds without errors
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] No compiler warnings
- [ ] Code formatted (rustfmt, prettier)

**PR Description Template:**
```markdown
## What does this PR do?

[Brief description]

## Why is this needed?

[Explain the problem or use case]

## How was this tested?

- [ ] Manual testing
- [ ] Automated tests added
- [ ] Tested on macOS/Linux
- [ ] Tested with Chrome Stable/Beta/Dev

## Screenshots (if applicable)

[Add screenshots or GIFs]

## Checklist

- [ ] Code builds cleanly
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No new warnings
- [ ] CHANGELOG.md updated (for significant changes)

## Related Issues

Closes #[issue number]
```

## Coding Guidelines

### Rust

```rust
// Good: Clear function names, documented purpose
/// Authorize session with time limit
pub async fn authorize_session(&self, duration: Duration) -> Result<()> {
    // Implementation
}

// Good: Proper error handling
let credentials = self.credentials.read().await;
let cred = credentials
    .get(id)
    .ok_or_else(|| anyhow!("Credential not found"))?;

// Avoid: Unwrap in library code
let cred = credentials.get(id).unwrap(); // ❌ Don't do this
```

### TypeScript

```typescript
// Good: Type safety, clear interfaces
interface LlmQueryRequest {
  prompt: string;
  context?: {
    url?: string;
    error?: string;
  };
  screenshot?: string;
}

// Good: Async/await with error handling
async function queryLlm(request: LlmQueryRequest): Promise<string> {
  try {
    return await manager.query(request);
  } catch (error) {
    console.error('[LLM] Query failed:', error);
    throw error;
  }
}

// Avoid: Untyped functions
function doSomething(data: any) { // ❌ Use specific types
  // ...
}
```

### Testing

```rust
// Good: Clear test names, focused assertions
#[test]
fn test_authorization_expires_after_duration() {
    let store = CredentialStore::new();
    store.authorize_session(Duration::from_secs(3600)).await?;

    assert!(store.is_session_authorized().await);
    // Test expiration logic
}
```

```typescript
// Good: Descriptive test with arrange-act-assert
test('LLM query times out after 30 seconds', async () => {
  const manager = getLlmQueryManager();

  await expect(
    manager.query({ prompt: 'test', timeout: 100 })
  ).rejects.toThrow('timeout');
});
```

## Documentation

### Code Comments

- Document **why**, not what
- Use doc comments for public APIs
- Keep comments up-to-date with code changes

```rust
// Good: Explains rationale
/// Authorize session for duration (requires Touch ID on macOS)
///
/// TODO: Add Touch ID verification here
/// For now, just grant authorization
pub async fn authorize_session(&self, duration: Duration) -> Result<()> {
    // ...
}

// Avoid: States the obvious
/// This function authorizes a session  // ❌ Doesn't add value
pub async fn authorize_session(&self, duration: Duration) -> Result<()> {
    // ...
}
```

### README Updates

Update documentation when adding features:
- README.md - High-level features
- QUICKSTART.md - Installation steps
- CHANGELOG.md - Version changes

## Review Process

### For Contributors

1. **Self-review** your PR before requesting review
2. **Respond to feedback** promptly and professionally
3. **Update PR** based on review comments
4. **Rebase** on main if needed

### For Reviewers

1. **Be respectful** and constructive
2. **Test the changes** locally when possible
3. **Focus on:**
   - Correctness and functionality
   - Code quality and maintainability
   - Security implications
   - Performance impact
4. **Approve** when ready or **request changes** with clear feedback

## Release Process

(For maintainers)

1. Update version in `Cargo.toml` and `package.json`
2. Update `CHANGELOG.md` with release notes
3. Create git tag: `git tag -a v0.x.0 -m "Release v0.x.0"`
4. Push tag: `git push origin v0.x.0`
5. Create GitHub release with notes from CHANGELOG
6. Build release binaries (if applicable)

## Getting Help

- **Documentation:** Check README.md and other docs first
- **Issues:** Search existing issues before creating new ones
- **Discussions:** Use GitHub Discussions for questions and ideas
- **Contact:** Open an issue for project-related questions

## Recognition

Contributors will be recognized in:
- GitHub contributor list
- Release notes for significant contributions
- CHANGELOG.md for feature additions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

See [LICENSE](LICENSE) for details.

---

Thank you for contributing to Agent Browser! 🎉
