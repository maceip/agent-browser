# Troubleshooting

Use this checklist when the installation scripts report errors, the extension badge stays red, or MCP calls fail.

## Verify the install

1. Run `./scripts/verify-install.sh` — confirms binaries, manifests, extension build outputs, and TCP ports
2. Open `chrome://extensions/`, enable *Developer mode*, and check that `extension/public` is loaded without warnings
3. Inspect the background page ("Inspect views") for logs related to email configuration or MCP connectivity
4. From a terminal, run `nc localhost 8084` and send `{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }` to verify the MCP endpoint responds

## Common issues

- **Native messaging manifest missing** — ensure `com.agentbrowser.native.json` exists in each Chrome profile you are using
- **Badge stuck on red ✗** — the Rust server is unreachable; check that the server process is running or start it manually
- **Magic links not detected** — confirm the email provider configuration is complete (badge tooltip shows the stored address) and that you are signed in to webmail
- **Passkey authorization expired** — rerun the authorization flow via the welcome screen or call `passkey_authorize`

## Logs & diagnostics

- `~/.agent-browser/audit.log` tracks passkey events and authorization windows
- Chrome DevTools console for the active tab reveals DOM automation steps and detection heuristics
- The Rust server logs to stdout/stderr; when launched via Claude you can view output with `claude mcp logs agent-browser`

## Getting help

If local debugging fails:

1. Capture the output of `./scripts/verify-install.sh`
2. Save relevant snippets from the Chrome background page console
3. Open a GitHub issue with the above information plus reproduction steps and platform details

Security disclosures should be sent privately to the maintainers before a public issue is filed.
