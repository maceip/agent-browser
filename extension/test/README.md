# Magic Link Test Application

Test application for validating magic link automation with real email delivery.

## Architecture

```
┌─────────────────────────────────────────────┐
│ React Client (Port 3456)                    │
│ - Signup/signin form                        │
│ - Code verification UI                      │
│ - Magic link waiting state                  │
│ - Session polling                           │
└────────────┬────────────────────────────────┘
             │
             ↓ HTTP API
┌─────────────────────────────────────────────┐
│ Bun Server (Port 3456)                      │
│ - POST /api/auth                            │
│ - POST /api/verify-code                     │
│ - GET  /verify?token=...                    │
│ - POST /api/session                         │
└────────────┬────────────────────────────────┘
             │
             ↓ Resend API
┌─────────────────────────────────────────────┐
│ Email Delivery (Resend)                     │
│ - 50% chance: 5-digit code                  │
│ - 50% chance: Magic link                    │
│ - From: test@auth.mail.kontext.dev          │
└─────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
cd extension/test/server && bun install
cd ../client && bun install

# Start server (serves both API and client)
cd ../server && bun dev
```

Open http://localhost:3456

## Testing with Extension

1. Complete extension welcome flow with your email
2. Use same email in test app at http://localhost:3456
3. Watch extension badges automate the magic link flow!

## API Endpoints

- `POST /api/auth` - Submit email, get code or magic link
- `POST /api/verify-code` - Verify 5-digit code
- `GET /verify?token=xyz` - Magic link endpoint
- `POST /api/session` - Check auth status

See full docs in extension/test/server/index.ts
