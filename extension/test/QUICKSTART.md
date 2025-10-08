# Quick Start - Passkey Automation Test

## 1-Minute Setup

### Terminal 1: Start Test Server

```bash
cd extension/test
bun run dev
```

You should see:
```
🔐 WebAuthn Test Server

Server running at: http://localhost:3000
Open in browser:   http://localhost:3000
```

### Terminal 2: Start Agent Browser Server

```bash
cd server
cargo run --release
```

You should see:
```
Agent Browser Server starting...
WebSocket server listening on 127.0.0.1:8085
MCP TCP server listening on 127.0.0.1:8084
```

### Terminal 3: Authorize and Run Test

```bash
# Authorize for 8 hours
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"passkey_authorize","arguments":{"duration_hours":8}}}' | nc localhost 8084

# Run automated test
cd extension/test
bun run test
```

## Expected Result

```
╔════════════════════════════════════════════════════════╗
║  Agent Browser - Passkey Automation Test              ║
╚════════════════════════════════════════════════════════╝

📋 Step 1: Check authorization status
✓ Authorized (expires in 479 minutes)

📋 Step 2: Enable passkey automation
✓ Passkey automation enabled

... (more steps)

╔════════════════════════════════════════════════════════╗
║  ✓ TEST COMPLETE                                      ║
╚════════════════════════════════════════════════════════╝

Passkey automation is working! 🎉
```

## Manual Test

1. Open `http://localhost:3000` in Chrome
2. Enter username and email
3. Click "Create Passkey"
4. Watch passkey get created automatically!
5. Click "Sign In with Passkey"
6. Watch authentication happen automatically!

## Troubleshooting

### "No extension connected"
- Load extension: `chrome://extensions/` → Load unpacked → `extension/public`

### "Not authorized"
- Run: `echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"passkey_authorize","arguments":{"duration_hours":8}}}' | nc localhost 8084`

### Port already in use
- Kill process: `lsof -ti:3000 | xargs kill -9`

## Next Steps

See `README.md` for detailed documentation.
