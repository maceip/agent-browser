# Passkey Authorization

Agent Browser proxies WebAuthn requests so Claude can complete passkey challenges on your behalf. Access is gated behind explicit, time-bound authorization windows that you control.

## Authorization windows

- Use the extension's welcome screen or the `passkey_authorize` MCP tool to grant access
- Default duration is five minutes when triggered from the UI; the MCP tool accepts `duration_hours`
- While active, the server responds to WebAuthn requests coming from the browser automation flow
- When the window expires, automation receives `not authorized` errors until you re-authorize

Example MCP invocation (from a terminal with Claude CLI installed):

```bash
claude mcp call agent-browser passkey_authorize '{"duration_hours": 0.5}'
```

Check the remaining time at any point:

```bash
claude mcp call agent-browser passkey_status '{}'
```

## Credential storage

- Encrypted credentials live in `~/.agent-browser/credentials.json`
- A random 32-byte master key is generated on first run and stored as `~/.agent-browser/master.key`
- Each action is logged to `~/.agent-browser/audit.log` with timestamps
- Directory permissions are restricted to the current user (`0700`), and files adopt the same discipline on Unix platforms

## Managing passkeys

Available MCP tools:

- `passkey_list` — returns metadata (RP ID, created timestamp, usage count) without private material
- `passkey_clear` — removes every stored credential and writes an audit log entry
- `passkey_enable` — toggles automatic passkey handling on or off inside the extension

Pair these commands with Chrome DevTools or Claude transcripts to confirm automation is using the expected credential.

## Security notes

- The native messaging host keeps the Rust server local; no credential material leaves your machine
- Audit the `audit.log` file after each session if you need a record of credential usage
- Regenerate credentials by clearing them and re-registering on the target site if you suspect compromise
- To revoke access immediately, run `passkey_clear` or delete `~/.agent-browser/` and restart the extension
