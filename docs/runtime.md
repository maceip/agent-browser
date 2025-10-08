# Runtime Reference

Use this guide while operating Agent Browser in development or production-like environments.

## Ports & transports

- `8084/tcp` — MCP server (enable by setting `MCP_TCP=1` before launching the Rust binary)
- stdio — MCP server when invoked by Claude with `--env MCP_STDIO=1`
- `8085/tcp` — WebSocket bridge consumed by the Chrome extension

The native messaging host starts the Rust server with `MCP_TCP=1`, so the TCP endpoint is usually available once the extension badge turns green.

## Environment variables

- `MCP_TCP=1` — listen for MCP requests on TCP `localhost:8084`
- `MCP_STDIO=1` — serve MCP over stdio (used by Claude CLI integration)

Set these before executing `/usr/local/bin/agent-browser-server` when launching it manually. Both variables can be supplied simultaneously if you need stdio and TCP at once.

## Binaries & processes

- `/usr/local/bin/agent-browser-server` — primary MCP server (Rust)
- `/usr/local/bin/agent-browser-nmh` — native messaging shim launched by Chrome

`agent-browser-nmh` spawns the server if it is not already running and connects the Chrome extension to the WebSocket endpoint.

## Data & logs

All persistent data lives under `~/.agent-browser/`:

- `credentials.json` — encrypted passkey entries
- `master.key` — encryption key for the credential store
- `audit.log` — append-only record of authorizations and credential events

Chrome-specific state (email configuration, badge status) resides in `chrome.storage.local` for the profile you used to load the extension.

## Helpful scripts

- `./scripts/launch-browser.sh` — starts Chrome with an isolated profile and loads the extension
- `./scripts/verify-install.sh` — checks binaries, manifests, extension build artefacts, and bound ports
- `./scripts/test-nmh.js` — quick check that the native messaging host responds

Run these whenever you suspect Chrome cannot reach the server, the badge stays red, or MCP calls fail.
