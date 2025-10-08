/**
 * WebAuthn Proxy for Passkey Automation
 *
 * Intercepts WebAuthn requests and handles them for automated browser testing.
 * Supports both creation (registration) and authentication (login) flows.
 */

export interface StoredCredential {
  id: ArrayBuffer;
  rpId: string;
  userHandle?: ArrayBuffer;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  created: number;
}

export interface WebAuthnProxyStatus {
  attached: boolean;
  automationMode: boolean;
  credentialsCount: number;
  error?: string;
}

export class WebAuthnProxy {
  private isAttached = false;
  private storedCredentials = new Map<string, StoredCredential>();
  private automationMode = false;

  async initialize(): Promise<void> {
    try {
      // @ts-ignore - webAuthenticationProxy is a Chrome extension API
      await chrome.webAuthenticationProxy.attach();

      this.isAttached = true;
      console.log('[WebAuthnProxy] Attached successfully');

      this.setupEventListeners();
    } catch (error) {
      console.error('[WebAuthnProxy] Failed to attach:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // @ts-ignore
    chrome.webAuthenticationProxy.onCreateRequest.addListener(
      (requestId: number, request: any) => {
        this.handleCreateRequest(requestId, request);
      }
    );

    // @ts-ignore
    chrome.webAuthenticationProxy.onGetRequest.addListener(
      (requestId: number, request: any) => {
        this.handleGetRequest(requestId, request);
      }
    );
  }

  private async handleCreateRequest(requestId: number, request: any): Promise<void> {
    try {
      console.log('[WebAuthnProxy] Create request:', request);

      if (this.automationMode) {
        // Simulate credential creation
        const credential = await this.simulateCredentialCreation(request);

        // Store for future use
        this.storeCredential({
          id: credential.id,
          rpId: request.rp.id,
          userHandle: request.user.id,
          privateKey: credential.privateKey,
          publicKey: credential.publicKey,
          created: Date.now()
        });

        // Complete the request
        // @ts-ignore
        chrome.webAuthenticationProxy.completeCreateRequest(requestId, {
          credentialId: credential.id,
          attestationObject: credential.attestationObject,
          clientDataJSON: credential.clientDataJSON
        });

        return;
      }

      // In normal mode, cancel the request
      // @ts-ignore
      chrome.webAuthenticationProxy.completeCreateRequest(requestId, {
        error: { name: "NotAllowedError", message: "User cancelled" }
      });

    } catch (error) {
      console.error('[WebAuthnProxy] Error handling create request:', error);
      // @ts-ignore
      chrome.webAuthenticationProxy.completeCreateRequest(requestId, {
        error: { name: "UnknownError", message: (error as Error).message }
      });
    }
  }

  private async handleGetRequest(requestId: number, request: any): Promise<void> {
    try {
      console.log('[WebAuthnProxy] Get request:', request);

      if (this.automationMode) {
        // Find matching credential
        const credential = this.findMatchingCredential(request);

        if (credential) {
          // Simulate authentication
          const authResponse = await this.simulateAuthentication(credential, request);

          // @ts-ignore
          chrome.webAuthenticationProxy.completeGetRequest(requestId, {
            credentialId: credential.id,
            authenticatorData: authResponse.authenticatorData,
            signature: authResponse.signature,
            userHandle: credential.userHandle,
            clientDataJSON: authResponse.clientDataJSON
          });

          return;
        }
      }

      // No matching credential or not in automation mode
      // @ts-ignore
      chrome.webAuthenticationProxy.completeGetRequest(requestId, {
        error: { name: "NotAllowedError", message: "No matching credential" }
      });

    } catch (error) {
      console.error('[WebAuthnProxy] Error handling get request:', error);
      // @ts-ignore
      chrome.webAuthenticationProxy.completeGetRequest(requestId, {
        error: { name: "UnknownError", message: (error as Error).message }
      });
    }
  }

  private findMatchingCredential(request: any): StoredCredential | null {
    for (const [, credential] of this.storedCredentials) {
      if (credential.rpId === request.rpId) {
        // Check if credential ID is in allowed list (if specified)
        if (request.allowCredentials && request.allowCredentials.length > 0) {
          const allowed = request.allowCredentials.some((allowed: any) =>
            this.arrayBufferEqual(allowed.id, credential.id)
          );
          if (!allowed) continue;
        }

        return credential;
      }
    }

    return null;
  }

  private async simulateCredentialCreation(request: any): Promise<{
    id: ArrayBuffer;
    attestationObject: Uint8Array;
    clientDataJSON: Uint8Array;
    privateKey: CryptoKey;
    publicKey: CryptoKey;
  }> {
    // Generate a simulated credential ID
    const credentialId = crypto.getRandomValues(new Uint8Array(32));

    // Generate key pair for signing
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256"
      },
      true,
      ["sign", "verify"]
    );

    // Create minimal attestation object (none format)
    const attestationObject = new Uint8Array([
      0xa3, // map with 3 entries
      0x63, 0x66, 0x6d, 0x74, // "fmt"
      0x64, 0x6e, 0x6f, 0x6e, 0x65, // "none"
      0x67, 0x61, 0x74, 0x74, 0x53, 0x74, 0x6d, 0x74, // "attStmt"
      0xa0, // empty map
      0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61, // "authData"
      0x58, 0x25 // byte string of length 37
      // ... simplified authData would go here
    ]);

    // Create client data JSON
    const clientData = {
      type: "webauthn.create",
      challenge: this.arrayBufferToBase64(request.challenge),
      origin: request.origin || window.location.origin,
      crossOrigin: false
    };

    return {
      id: credentialId.buffer,
      attestationObject: attestationObject,
      clientDataJSON: new TextEncoder().encode(JSON.stringify(clientData)),
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey
    };
  }

  private async simulateAuthentication(credential: StoredCredential, request: any): Promise<{
    authenticatorData: Uint8Array;
    signature: Uint8Array;
    clientDataJSON: Uint8Array;
  }> {
    // Create client data for authentication
    const clientData = {
      type: "webauthn.get",
      challenge: this.arrayBufferToBase64(request.challenge),
      origin: request.origin || window.location.origin,
      crossOrigin: false
    };

    const clientDataJSON = new TextEncoder().encode(JSON.stringify(clientData));

    // Create authenticator data (simplified)
    const authenticatorData = new Uint8Array(37); // Minimal authData
    authenticatorData[32] = 0x01; // User present flag

    // Create signature
    const dataToSign = new Uint8Array(authenticatorData.length + 32);
    dataToSign.set(authenticatorData);

    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      credential.privateKey,
      dataToSign
    );

    return {
      authenticatorData: authenticatorData,
      signature: new Uint8Array(signature),
      clientDataJSON: clientDataJSON
    };
  }

  private storeCredential(credential: StoredCredential): void {
    const id = this.arrayBufferToBase64(credential.id);
    this.storedCredentials.set(id, credential);
    console.log(`[WebAuthnProxy] Stored credential for ${credential.rpId}`);
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private arrayBufferEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
    if (a.byteLength !== b.byteLength) return false;
    const view1 = new Uint8Array(a);
    const view2 = new Uint8Array(b);
    for (let i = 0; i < view1.length; i++) {
      if (view1[i] !== view2[i]) return false;
    }
    return true;
  }

  // ============================================================================
  // Public API for Control
  // ============================================================================

  enableAutomation(enabled = true): void {
    this.automationMode = enabled;
    console.log(`[WebAuthnProxy] Automation mode: ${enabled ? 'enabled' : 'disabled'}`);
  }

  getStoredCredentials(): Array<{
    id: string;
    rpId: string;
    userHandle: string | null;
    created: number;
  }> {
    return Array.from(this.storedCredentials.values()).map(cred => ({
      id: this.arrayBufferToBase64(cred.id),
      rpId: cred.rpId,
      userHandle: cred.userHandle ? this.arrayBufferToBase64(cred.userHandle) : null,
      created: cred.created
    }));
  }

  clearStoredCredentials(): void {
    this.storedCredentials.clear();
    console.log('[WebAuthnProxy] Cleared all stored credentials');
  }

  getStatus(): WebAuthnProxyStatus {
    return {
      attached: this.isAttached,
      automationMode: this.automationMode,
      credentialsCount: this.storedCredentials.size
    };
  }
}
