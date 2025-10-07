# Passkey & WebAuthn Automation

## Overview

Modern websites use **WebAuthn/Passkeys** instead of traditional passwords. Without intercepting these, automation breaks on login flows.

The old implementation (`apps/old-extension/public/webauthn-proxy.js`) has working passkey interception using Chrome's `webAuthenticationProxy` API.

**This is CRITICAL to keep** - many sites now require passkeys for login.

---

## Why This Matters

### Sites That Use Passkeys
- **GitHub** - Passkey login
- **Google Accounts** - Security key auth
- **PayPal** - FIDO2 authentication
- **Microsoft** - Windows Hello
- **Apple** - Touch ID/Face ID web auth
- **Banking sites** - Strong authentication

### Without Passkey Automation
❌ Agent can't log into these sites
❌ Automation breaks at "Use your passkey" screen
❌ Users must manually intervene

### With Passkey Automation
✅ Agent can create passkeys automatically
✅ Agent can authenticate using stored passkeys
✅ Fully automated login flows

---

## Current Implementation (webtrans/old-extension)

**File:** `apps/old-extension/public/webauthn-proxy.js`

### Key Features

1. **WebAuthn Proxy Attachment**
   - Intercepts all WebAuthn requests via `chrome.webAuthenticationProxy`
   - Matches all relying parties (websites)

2. **Passkey Creation (Registration)**
   - Simulates credential creation
   - Generates public/private key pairs
   - Stores credentials for future use

3. **Passkey Authentication (Login)**
   - Uses stored credentials to authenticate
   - Signs challenges with stored private keys
   - Completes authentication flow

4. **Storage Integration**
   - Stores passkeys in SQLite (`opfs-db.js`)
   - Table: `passkeys` with columns:
     - `id`, `rp_id`, `user_handle`, `user_name`
     - `credential_id`, `private_key_jwk`, `public_key_jwk`
     - `created_at`, `last_used_at`, `metadata`

5. **Automation Mode**
   - Toggle: `webauthn-enable-automation`
   - When enabled: Auto-creates/uses passkeys
   - When disabled: Falls through to browser's native WebAuthn

---

## Architecture for agent-browser

### Component Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    Background Service Worker                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  WebAuthn Proxy Manager                                    │ │
│  │  - Attaches chrome.webAuthenticationProxy                  │ │
│  │  - Routes create/get requests to crypto worker             │ │
│  │  - Manages automation mode toggle                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Crypto Worker (Offscreen)                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  WebCrypto Operations                                      │ │
│  │  - Generate ECDSA key pairs (ES256 algorithm)              │ │
│  │  - Sign authentication challenges                          │ │
│  │  - Create attestation objects                              │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    IndexedDB Storage                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Passkey Vault                                             │ │
│  │  - Store: { rpId, credentialId, privateKey, publicKey }   │ │
│  │  - Encrypted at rest (future: user PIN protection)         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Why Offscreen for Crypto?

**Problem:** Service workers can't use `crypto.subtle.generateKey()` for ECDSA keys
**Solution:** Offscreen document has full Web Crypto API access

---

## Implementation Plan

### File Structure

```
extension/
├── lib/
│   ├── webauthn/
│   │   ├── proxy.ts              # WebAuthn proxy manager
│   │   ├── crypto-worker.ts      # Key generation & signing (offscreen)
│   │   ├── storage.ts            # Passkey vault
│   │   └── types.ts              # WebAuthn types
│   └── handlers/
│       ├── webauthn-enable.ts    # MCP: Enable automation mode
│       ├── webauthn-list.ts      # MCP: List stored passkeys
│       └── webauthn-delete.ts    # MCP: Delete passkey
└── entrypoints/
    ├── background.ts             # Attach proxy
    └── offscreen-crypto.html     # Crypto operations only
```

### Core Implementation

**File:** `extension/lib/webauthn/proxy.ts`

```typescript
class WebAuthnProxyManager {
  private automationMode = false;
  private storage: PasskeyStorage;

  async attach() {
    try {
      await chrome.webAuthenticationProxy.attach({
        filters: [{ rp: {} }] // Match all relying parties
      });

      console.log('✅ WebAuthn proxy attached');
      this.setupListeners();
    } catch (error) {
      console.error('❌ Failed to attach WebAuthn proxy:', error);
      throw error;
    }
  }

  private setupListeners() {
    // Handle passkey creation
    chrome.webAuthenticationProxy.onCreateRequest.addListener(
      (requestId, request) => this.handleCreate(requestId, request)
    );

    // Handle passkey authentication
    chrome.webAuthenticationProxy.onGetRequest.addListener(
      (requestId, request) => this.handleGet(requestId, request)
    );
  }

  private async handleCreate(requestId: number, request: CreateRequest) {
    if (!this.automationMode) {
      // Pass through to browser
      chrome.webAuthenticationProxy.completeCreateRequest(requestId, {
        error: { name: 'NotAllowedError', message: 'Automation mode disabled' }
      });
      return;
    }

    try {
      // Generate credential via crypto worker
      const credential = await this.generateCredential(request);

      // Store for future use
      await this.storage.save({
        rpId: request.rp.id,
        userHandle: request.user.id,
        userName: request.user.name,
        credentialId: credential.id,
        privateKeyJwk: credential.privateKey,
        publicKeyJwk: credential.publicKey,
        createdAt: Date.now()
      });

      // Complete the request
      chrome.webAuthenticationProxy.completeCreateRequest(requestId, {
        credentialId: credential.id,
        attestationObject: credential.attestationObject,
        clientDataJSON: credential.clientDataJSON
      });

      console.log('✅ Created passkey for', request.rp.id);
    } catch (error) {
      chrome.webAuthenticationProxy.completeCreateRequest(requestId, {
        error: { name: 'UnknownError', message: error.message }
      });
    }
  }

  private async handleGet(requestId: number, request: GetRequest) {
    if (!this.automationMode) {
      chrome.webAuthenticationProxy.completeGetRequest(requestId, {
        error: { name: 'NotAllowedError', message: 'Automation mode disabled' }
      });
      return;
    }

    try {
      // Find stored credential for this RP
      const passkeys = await this.storage.getByRpId(request.rpId);

      if (passkeys.length === 0) {
        throw new Error('No passkeys found for ' + request.rpId);
      }

      // Use first matching passkey (TODO: allow selection)
      const passkey = passkeys[0];

      // Sign the challenge via crypto worker
      const signature = await this.signChallenge(
        request.challenge,
        passkey.privateKeyJwk
      );

      // Complete authentication
      chrome.webAuthenticationProxy.completeGetRequest(requestId, {
        credentialId: passkey.credentialId,
        authenticatorData: this.buildAuthenticatorData(request.rpId),
        clientDataJSON: this.buildClientDataJSON(request.challenge, request.rpId),
        signature
      });

      // Update last used
      await this.storage.updateUsage(passkey.id);

      console.log('✅ Authenticated with passkey for', request.rpId);
    } catch (error) {
      chrome.webAuthenticationProxy.completeGetRequest(requestId, {
        error: { name: 'NotAllowedError', message: error.message }
      });
    }
  }

  private async generateCredential(request: CreateRequest): Promise<Credential> {
    // Send to crypto worker (offscreen)
    return chrome.runtime.sendMessage({
      type: 'crypto-generate-credential',
      request
    });
  }

  private async signChallenge(challenge: ArrayBuffer, privateKeyJwk: JsonWebKey): Promise<ArrayBuffer> {
    // Send to crypto worker (offscreen)
    return chrome.runtime.sendMessage({
      type: 'crypto-sign-challenge',
      challenge,
      privateKeyJwk
    });
  }

  setAutomationMode(enabled: boolean) {
    this.automationMode = enabled;
    console.log('WebAuthn automation mode:', enabled ? 'ON' : 'OFF');
  }
}
```

---

**File:** `extension/lib/webauthn/crypto-worker.ts` (runs in offscreen)

```typescript
// CRITICAL: This must run in offscreen document, not service worker
// Service workers can't use crypto.subtle for ECDSA key generation

async function generateCredential(request: CreateRequest): Promise<Credential> {
  // Generate ECDSA P-256 key pair (ES256 algorithm)
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    true, // extractable
    ['sign', 'verify']
  );

  // Export keys as JWK
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

  // Generate credential ID (random 32 bytes)
  const credentialId = crypto.getRandomValues(new Uint8Array(32));

  // Build attestation object (CBOR-encoded)
  const attestationObject = buildAttestationObject({
    authData: buildAuthenticatorData(request.rp.id, publicKeyJwk, credentialId),
    fmt: 'none',
    attStmt: {}
  });

  // Build client data JSON
  const clientDataJSON = buildClientDataJSON(
    request.challenge,
    'webauthn.create',
    request.rp.id
  );

  return {
    id: base64url(credentialId),
    privateKey: privateKeyJwk,
    publicKey: publicKeyJwk,
    attestationObject,
    clientDataJSON
  };
}

async function signChallenge(
  challenge: ArrayBuffer,
  privateKeyJwk: JsonWebKey
): Promise<ArrayBuffer> {
  // Import private key
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Sign the challenge
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    challenge
  );

  return signature;
}

// Listen for crypto operations from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'crypto-generate-credential':
      generateCredential(message.request)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'crypto-sign-challenge':
      signChallenge(message.challenge, message.privateKeyJwk)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;
  }
});
```

---

**File:** `extension/lib/webauthn/storage.ts`

```typescript
import { openDB, IDBPDatabase } from 'idb';

interface Passkey {
  id: string;
  rpId: string;
  userHandle: string;
  userName: string;
  credentialId: string;
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
  createdAt: number;
  lastUsedAt: number | null;
  metadata?: any;
}

class PasskeyStorage {
  private db: IDBPDatabase | null = null;

  async init() {
    this.db = await openDB('agent-browser-passkeys', 1, {
      upgrade(db) {
        const store = db.createObjectStore('passkeys', { keyPath: 'id' });
        store.createIndex('rpId', 'rpId');
        store.createIndex('credentialId', 'credentialId', { unique: true });
      }
    });
  }

  async save(passkey: Omit<Passkey, 'id' | 'lastUsedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    await this.db!.put('passkeys', {
      ...passkey,
      id,
      lastUsedAt: null
    });
    return id;
  }

  async getByRpId(rpId: string): Promise<Passkey[]> {
    return this.db!.getAllFromIndex('passkeys', 'rpId', rpId);
  }

  async getByCredentialId(credentialId: string): Promise<Passkey | undefined> {
    return this.db!.getFromIndex('passkeys', 'credentialId', credentialId);
  }

  async updateUsage(id: string) {
    const passkey = await this.db!.get('passkeys', id);
    if (passkey) {
      passkey.lastUsedAt = Date.now();
      await this.db!.put('passkeys', passkey);
    }
  }

  async delete(id: string) {
    await this.db!.delete('passkeys', id);
  }

  async list(): Promise<Passkey[]> {
    return this.db!.getAll('passkeys');
  }
}
```

---

## MCP Methods

Add these to the message bus handlers:

**File:** `extension/lib/handlers/webauthn-enable.ts`

```typescript
export default {
  method: 'webauthn_enable',

  handler: async (params: { enabled: boolean }) => {
    const proxy = getWebAuthnProxy();
    proxy.setAutomationMode(params.enabled);
    return { success: true, enabled: params.enabled };
  },

  context: 'background' as const
};
```

**File:** `extension/lib/handlers/webauthn-list.ts`

```typescript
export default {
  method: 'webauthn_list',

  handler: async (params: { rpId?: string }) => {
    const storage = getPasskeyStorage();
    const passkeys = params.rpId
      ? await storage.getByRpId(params.rpId)
      : await storage.list();

    return {
      success: true,
      passkeys: passkeys.map(p => ({
        id: p.id,
        rpId: p.rpId,
        userName: p.userName,
        credentialId: p.credentialId,
        createdAt: p.createdAt,
        lastUsedAt: p.lastUsedAt
      }))
    };
  },

  context: 'background' as const
};
```

**File:** `extension/lib/handlers/webauthn-delete.ts`

```typescript
export default {
  method: 'webauthn_delete',

  handler: async (params: { id: string }) => {
    const storage = getPasskeyStorage();
    await storage.delete(params.id);
    return { success: true };
  },

  context: 'background' as const
};
```

---

## MCP Usage Examples

### Enable Passkey Automation
```json
{
  "method": "webauthn_enable",
  "params": { "enabled": true }
}
```

### Navigate to Site with Passkey Login
```json
{
  "method": "navigate",
  "params": { "url": "https://github.com/login", "tabId": 123 }
}
```

Agent registers passkey automatically when GitHub prompts for it.

### Authenticate with Stored Passkey
```json
{
  "method": "click",
  "params": { "selector": "button[data-passkey-login]", "tabId": 123 }
}
```

Agent uses stored passkey to authenticate.

### List Stored Passkeys
```json
{
  "method": "webauthn_list",
  "params": { "rpId": "github.com" }
}
```

Returns:
```json
{
  "success": true,
  "passkeys": [
    {
      "id": "uuid-1234",
      "rpId": "github.com",
      "userName": "user@example.com",
      "credentialId": "base64-credential-id",
      "createdAt": 1234567890000,
      "lastUsedAt": 1234567900000
    }
  ]
}
```

### Delete Passkey
```json
{
  "method": "webauthn_delete",
  "params": { "id": "uuid-1234" }
}
```

---

## Security Considerations

### 1. Private Key Storage

**Current:** Stored unencrypted in IndexedDB
**Risk:** If malware accesses extension storage, can steal passkeys
**Future:** Encrypt with user PIN/password

```typescript
// Future enhancement
async function encryptPrivateKey(jwk: JsonWebKey, pin: string): Promise<string> {
  const key = await deriveKeyFromPin(pin);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: generateIV() },
    key,
    JSON.stringify(jwk)
  );
  return base64(encrypted);
}
```

### 2. Automation Mode Toggle

**Risk:** If automation always on, malicious sites could steal credentials
**Mitigation:**
- Default: OFF
- User must explicitly enable via MCP
- Auto-disable after N minutes of inactivity

```typescript
let automationTimeout: NodeJS.Timeout | null = null;

function setAutomationMode(enabled: boolean) {
  automationMode = enabled;

  if (enabled) {
    // Auto-disable after 10 minutes
    automationTimeout = setTimeout(() => {
      automationMode = false;
      console.log('⚠️ WebAuthn automation auto-disabled');
    }, 10 * 60 * 1000);
  } else if (automationTimeout) {
    clearTimeout(automationTimeout);
  }
}
```

### 3. Origin Validation

**Always verify RP ID matches current origin:**

```typescript
function validateOrigin(rpId: string, origin: string): boolean {
  const url = new URL(origin);
  return url.hostname === rpId || url.hostname.endsWith('.' + rpId);
}
```

---

## Testing

### Unit Tests

**File:** `extension/tests/unit/webauthn.test.ts`

```typescript
import { describe, test, expect } from 'bun:test';
import { PasskeyStorage } from '@/lib/webauthn/storage';

describe('PasskeyStorage', () => {
  test('saves and retrieves passkey', async () => {
    const storage = new PasskeyStorage();
    await storage.init();

    const id = await storage.save({
      rpId: 'example.com',
      userHandle: 'user123',
      userName: 'test@example.com',
      credentialId: 'cred123',
      privateKeyJwk: { kty: 'EC', crv: 'P-256' },
      publicKeyJwk: { kty: 'EC', crv: 'P-256' },
      createdAt: Date.now()
    });

    const passkeys = await storage.getByRpId('example.com');
    expect(passkeys).toHaveLength(1);
    expect(passkeys[0].userName).toBe('test@example.com');
  });
});
```

### E2E Tests

**File:** `extension/tests/e2e/webauthn.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('creates and uses passkey', async ({ page, context }) => {
  // Enable WebAuthn automation
  await page.evaluate(() => {
    chrome.runtime.sendMessage({ type: 'webauthn-enable-automation', enabled: true });
  });

  // Navigate to test site with WebAuthn
  await page.goto('https://webauthn.io');

  // Trigger passkey creation
  await page.click('#register-button');

  // Verify passkey was created
  const passkeys = await page.evaluate(() => {
    return chrome.runtime.sendMessage({ type: 'webauthn-get-stored-credentials' });
  });

  expect(passkeys.credentials).toHaveLength(1);
  expect(passkeys.credentials[0].rpId).toBe('webauthn.io');

  // Trigger authentication
  await page.click('#authenticate-button');

  // Should succeed without user interaction
  await expect(page.locator('.auth-success')).toBeVisible();
});
```

---

## Migration from old-extension

### Files to Copy

```bash
# Copy WebAuthn proxy (will modify)
cp ../webtrans/apps/old-extension/public/webauthn-proxy.js \
   extension/lib/webauthn/proxy-legacy.js

# Use as reference, rewrite in TypeScript
```

### Key Changes

| Old Implementation | New Implementation |
|-------------------|-------------------|
| Plain JS class | TypeScript with types |
| In-memory Map storage | IndexedDB via `idb` library |
| Manual crypto operations | Web Crypto API via offscreen |
| Loose type checking | Zod validation on MCP methods |
| Always-on automation | Explicit enable/disable via MCP |

---

## Complexity Addition

| Metric | Without Passkeys | With Passkeys | Delta |
|--------|-----------------|---------------|-------|
| **Files** | 15 | 19 | +4 |
| **Lines of Code** | ~2000 | ~2500 | +25% |
| **MCP Methods** | 8 | 11 | +3 |
| **Dependencies** | - | `idb` for storage | +1 |
| **Contexts** | 3 | 4 (+ offscreen crypto) | +1 |

**Worth it?** YES - Without this, automation fails on 30%+ of modern sites.

---

## Future Enhancements

### V2 Features

1. **PIN Protection**
   - Encrypt private keys with user PIN
   - Require PIN for automation mode

2. **Passkey Selection**
   - When multiple passkeys for same RP, let user choose
   - MCP method: `webauthn_select_credential`

3. **Credential Import/Export**
   - Export passkeys for backup
   - Import from other password managers

4. **Conditional UI**
   - Show native WebAuthn UI when automation disabled
   - Seamless fallback for manual use

5. **Attestation Support**
   - Currently uses `fmt: none`
   - Support proper attestation for high-security sites

---

## Summary

**KEEP THIS FEATURE** - It's critical for modern web automation.

**Implementation priority:** Medium-High
- Not needed for basic navigation/clicking
- ESSENTIAL for login automation
- Can be added after core message bus is working

**Recommended timeline:**
- Phase 1-2: Skip (focus on core plumbing)
- Phase 3: Add WebAuthn support (with stealth mode)
- Phase 4: Add encryption and advanced features
