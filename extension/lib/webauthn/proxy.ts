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
  private automationMode = true; // Default to enabled

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
    // @ts-ignore - Chrome WebAuthenticationProxy API
    chrome.webAuthenticationProxy.onCreateRequest.addListener(
      (details: any) => {
        console.log('[WebAuthnProxy] onCreateRequest details:', details);
        // The API provides requestDetailsJson as a JSON string
        if (details && details.requestId !== undefined && details.requestDetailsJson) {
          try {
            const request = JSON.parse(details.requestDetailsJson);

            // Get the origin from the active tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]?.url) {
                const url = new URL(tabs[0].url);
                request.origin = url.origin;
              }
              this.handleCreateRequest(details.requestId, request);
            });
          } catch (error) {
            console.error('[WebAuthnProxy] Failed to parse requestDetailsJson:', error);
            // @ts-ignore
            chrome.webAuthenticationProxy.completeCreateRequest({
              requestId: details.requestId,
              error: { name: "UnknownError", message: "Failed to parse request details" }
            });
          }
        } else {
          console.error('[WebAuthnProxy] Invalid create request details:', details);
        }
      }
    );

    // @ts-ignore - Chrome WebAuthenticationProxy API
    chrome.webAuthenticationProxy.onGetRequest.addListener(
      (details: any) => {
        console.log('[WebAuthnProxy] onGetRequest details:', details);
        // The API provides requestDetailsJson as a JSON string
        if (details && details.requestId !== undefined && details.requestDetailsJson) {
          try {
            const request = JSON.parse(details.requestDetailsJson);

            // Get the origin from the active tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]?.url) {
                const url = new URL(tabs[0].url);
                request.origin = url.origin;
              }
              this.handleGetRequest(details.requestId, request);
            });
          } catch (error) {
            console.error('[WebAuthnProxy] Failed to parse requestDetailsJson:', error);
            // @ts-ignore
            chrome.webAuthenticationProxy.completeGetRequest({
              requestId: details.requestId,
              error: { name: "UnknownError", message: "Failed to parse request details" }
            });
          }
        } else {
          console.error('[WebAuthnProxy] Invalid get request details:', details);
        }
      }
    );
  }

  private async handleCreateRequest(requestId: number, request: any): Promise<void> {
    try {
      console.log('[WebAuthnProxy] Create request:', requestId, request);
      console.log('[WebAuthnProxy] Automation mode:', this.automationMode);
      console.log('[WebAuthnProxy] Request origin:', request.origin);
      console.log('[WebAuthnProxy] Request keys:', Object.keys(request));

      if (!request) {
        console.error('[WebAuthnProxy] Request is undefined, cancelling');
        // @ts-ignore
        chrome.webAuthenticationProxy.completeCreateRequest({
          requestId,
          error: { name: "NotAllowedError", message: "Invalid request" }
        });
        return;
      }

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

        // Complete the request with credential
        // Export public key in SPKI format
        const publicKeySpki = await crypto.subtle.exportKey('spki', credential.publicKey);

        // Create response in PublicKeyCredential.toJSON() format
        const response = {
          id: this.arrayBufferToBase64url(credential.id),
          rawId: this.arrayBufferToBase64url(credential.id),
          type: 'public-key',
          authenticatorAttachment: 'platform',
          clientExtensionResults: {},
          response: {
            clientDataJSON: this.arrayBufferToBase64url(credential.clientDataJSON.buffer),
            attestationObject: this.arrayBufferToBase64url(credential.attestationObject.buffer),
            authenticatorData: this.arrayBufferToBase64url(credential.authenticatorData.buffer),
            publicKey: this.arrayBufferToBase64url(publicKeySpki),
            publicKeyAlgorithm: -7, // ES256
            transports: ['internal']
          }
        };

        // @ts-ignore
        chrome.webAuthenticationProxy.completeCreateRequest({
          requestId,
          responseJson: JSON.stringify(response)
        });

        return;
      }

      // In normal mode, cancel the request
      // @ts-ignore
      chrome.webAuthenticationProxy.completeCreateRequest({
        requestId,
        error: { name: "NotAllowedError", message: "User cancelled" }
      });

    } catch (error) {
      console.error('[WebAuthnProxy] Error handling create request:', error);
      // @ts-ignore
      chrome.webAuthenticationProxy.completeCreateRequest({
        requestId,
        error: { name: "UnknownError", message: (error as Error).message }
      });
    }
  }

  private async handleGetRequest(requestId: number, request: any): Promise<void> {
    try {
      console.log('[WebAuthnProxy] Get request:', requestId, request);
      console.log('[WebAuthnProxy] Automation mode:', this.automationMode);
      console.log('[WebAuthnProxy] Request origin:', request.origin);
      console.log('[WebAuthnProxy] Request keys:', Object.keys(request));
      console.log('[WebAuthnProxy] Stored credentials count:', this.storedCredentials.size);

      if (!request) {
        console.error('[WebAuthnProxy] Request is undefined, cancelling');
        // @ts-ignore
        chrome.webAuthenticationProxy.completeGetRequest({
          requestId,
          error: { name: "NotAllowedError", message: "Invalid request" }
        });
        return;
      }

      if (this.automationMode) {
        // Find matching credential
        const credential = this.findMatchingCredential(request);
        console.log('[WebAuthnProxy] Found credential:', credential ? 'yes' : 'no');

        if (credential) {
          // Simulate authentication
          const authResponse = await this.simulateAuthentication(credential, request);

          // Create response in PublicKeyCredential.toJSON() format
          const response = {
            id: this.arrayBufferToBase64url(credential.id),
            rawId: this.arrayBufferToBase64url(credential.id),
            type: 'public-key',
            authenticatorAttachment: 'platform',
            clientExtensionResults: {},
            response: {
              clientDataJSON: this.arrayBufferToBase64url(authResponse.clientDataJSON.buffer),
              authenticatorData: this.arrayBufferToBase64url(authResponse.authenticatorData.buffer),
              signature: this.arrayBufferToBase64url(authResponse.signature.buffer),
              userHandle: credential.userHandle ? this.arrayBufferToBase64url(credential.userHandle) : undefined
            }
          };

          // @ts-ignore
          chrome.webAuthenticationProxy.completeGetRequest({
            requestId,
            responseJson: JSON.stringify(response)
          });

          return;
        }
      }

      // No matching credential or not in automation mode
      // @ts-ignore
      chrome.webAuthenticationProxy.completeGetRequest({
        requestId,
        error: { name: "NotAllowedError", message: "No matching credential" }
      });

    } catch (error) {
      console.error('[WebAuthnProxy] Error handling get request:', error);
      // @ts-ignore
      chrome.webAuthenticationProxy.completeGetRequest({
        requestId,
        error: { name: "UnknownError", message: (error as Error).message }
      });
    }
  }

  private findMatchingCredential(request: any): StoredCredential | null {
    console.log('[WebAuthnProxy] Finding credential for rpId:', request.rpId);
    console.log('[WebAuthnProxy] allowCredentials:', request.allowCredentials);

    for (const [credId, credential] of this.storedCredentials) {
      console.log('[WebAuthnProxy] Checking credential:', credId, 'rpId:', credential.rpId);

      if (credential.rpId === request.rpId) {
        // Check if credential ID is in allowed list (if specified)
        if (request.allowCredentials && request.allowCredentials.length > 0) {
          // allowed.id is a base64url string in the request
          const allowed = request.allowCredentials.some((allowedCred: any) => {
            // Convert base64url string to ArrayBuffer for comparison
            const allowedIdBytes = this.base64UrlToUint8Array(allowedCred.id);
            const match = this.arrayBufferEqual(allowedIdBytes.buffer, credential.id);
            console.log('[WebAuthnProxy] Comparing:', allowedCred.id, 'with stored, match:', match);
            return match;
          });
          if (!allowed) {
            console.log('[WebAuthnProxy] Credential not in allowed list');
            continue;
          }
        }

        console.log('[WebAuthnProxy] Found matching credential!');
        return credential;
      }
    }

    console.log('[WebAuthnProxy] No matching credential found');
    return null;
  }

  private async simulateCredentialCreation(request: any): Promise<{
    id: ArrayBuffer;
    attestationObject: Uint8Array;
    authenticatorData: Uint8Array;
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

    // Export public key to get coordinates
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const x = this.base64UrlToUint8Array(publicKeyJwk.x!);
    const y = this.base64UrlToUint8Array(publicKeyJwk.y!);

    // Create RP ID hash (SHA-256 of "localhost")
    const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(request.rp.id)));

    // Create authenticator data with attestedCredentialData
    const flags = 0x45; // UP (user present) + AT (attested credential data)
    const signCount = new Uint8Array(4); // 0
    const aaguid = new Uint8Array(16); // all zeros
    const credIdLength = new Uint8Array(2);
    credIdLength[0] = 0; // MSB
    credIdLength[1] = credentialId.length; // LSB

    // Create COSE public key (CBOR encoded)
    // Map with kty=2 (EC2), alg=-7 (ES256), crv=1 (P-256), x, y
    const coseKey = new Uint8Array([
      0xa5, // map(5)
      0x01, 0x02, // kty: 2 (EC2)
      0x03, 0x26, // alg: -7 (ES256)
      0x20, 0x01, // crv: 1 (P-256)
      0x21, 0x58, 0x20, ...x, // x coordinate (32 bytes)
      0x22, 0x58, 0x20, ...y  // y coordinate (32 bytes)
    ]);

    // Combine authData parts
    const authData = new Uint8Array(37 + aaguid.length + 2 + credentialId.length + coseKey.length);
    let offset = 0;
    authData.set(rpIdHash, offset); offset += 32;
    authData[offset++] = flags;
    authData.set(signCount, offset); offset += 4;
    authData.set(aaguid, offset); offset += 16;
    authData.set(credIdLength, offset); offset += 2;
    authData.set(credentialId, offset); offset += credentialId.length;
    authData.set(coseKey, offset);

    // Create CBOR attestation object: {fmt: "none", attStmt: {}, authData: bytes}
    const attestationObject = this.encodeCBORAttestationObject(authData);

    // Create client data JSON
    const clientData = {
      type: "webauthn.create",
      challenge: this.arrayBufferToBase64url(new Uint8Array(this.base64UrlToUint8Array(request.challenge))),
      origin: request.origin || 'http://localhost:3000',
      crossOrigin: false
    };

    return {
      id: credentialId.buffer,
      attestationObject: attestationObject,
      authenticatorData: authData,
      clientDataJSON: new TextEncoder().encode(JSON.stringify(clientData)),
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey
    };
  }

  private base64UrlToUint8Array(base64url: string): Uint8Array {
    // Add padding if needed
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(base64 + padding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private encodeCBORAttestationObject(authData: Uint8Array): Uint8Array {
    // CBOR map with 3 entries: {fmt: "none", attStmt: {}, authData: bytes}
    const result: number[] = [
      0xa3, // map(3)
      // "fmt" key
      0x63, 0x66, 0x6d, 0x74, // text(3) "fmt"
      // "none" value
      0x64, 0x6e, 0x6f, 0x6e, 0x65, // text(4) "none"
      // "attStmt" key
      0x67, 0x61, 0x74, 0x74, 0x53, 0x74, 0x6d, 0x74, // text(7) "attStmt"
      // empty map value
      0xa0, // map(0)
      // "authData" key
      0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61, // text(8) "authData"
      // bytes value
    ];

    // Add CBOR byte string header for authData
    if (authData.length < 24) {
      result.push(0x58, authData.length);
    } else if (authData.length < 256) {
      result.push(0x58, authData.length);
    } else {
      result.push(0x59, authData.length >> 8, authData.length & 0xff);
    }

    const output = new Uint8Array(result.length + authData.length);
    output.set(result);
    output.set(authData, result.length);
    return output;
  }

  private async simulateAuthentication(credential: StoredCredential, request: any): Promise<{
    authenticatorData: Uint8Array;
    signature: Uint8Array;
    clientDataJSON: Uint8Array;
  }> {
    // Create client data for authentication
    const clientData = {
      type: "webauthn.get",
      challenge: request.challenge, // Already a base64url string
      origin: request.origin || 'http://localhost:3000',
      crossOrigin: false
    };

    const clientDataJSON = new TextEncoder().encode(JSON.stringify(clientData));

    // Create authenticator data with proper RP ID hash
    // First 32 bytes: SHA-256 hash of RP ID
    const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(request.rpId)));

    // Byte 32: flags
    // Bit 0 (0x01): UP (User Present)
    // Bit 2 (0x04): UV (User Verified)
    const flags = 0x05; // UP + UV

    // Bytes 33-36: signature counter (4 bytes, big-endian)
    const signCount = new Uint8Array(4); // 0

    const authenticatorData = new Uint8Array(37);
    authenticatorData.set(rpIdHash, 0);
    authenticatorData[32] = flags;
    authenticatorData.set(signCount, 33);

    // Create signature over authenticatorData + hash(clientDataJSON)
    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON));
    const dataToSign = new Uint8Array(authenticatorData.length + clientDataHash.length);
    dataToSign.set(authenticatorData);
    dataToSign.set(clientDataHash, authenticatorData.length);

    const rawSignature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      credential.privateKey,
      dataToSign
    );

    // Convert raw signature (64 bytes) to DER format
    const derSignature = this.rawSignatureToDER(new Uint8Array(rawSignature));

    console.log('[WebAuthnProxy] Raw signature length:', rawSignature.byteLength);
    console.log('[WebAuthnProxy] DER signature length:', derSignature.byteLength);

    return {
      authenticatorData: authenticatorData,
      signature: derSignature,
      clientDataJSON: clientDataJSON
    };
  }

  private storeCredential(credential: StoredCredential): void {
    const id = this.arrayBufferToBase64url(credential.id);
    this.storedCredentials.set(id, credential);
    console.log(`[WebAuthnProxy] Stored credential for ${credential.rpId}, id: ${id}, total: ${this.storedCredentials.size}`);
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

  private arrayBufferToBase64url(buffer: ArrayBuffer): string {
    const base64 = this.arrayBufferToBase64(buffer);
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private rawSignatureToDER(rawSignature: Uint8Array): Uint8Array {
    // ECDSA P-256 signature is 64 bytes: r (32 bytes) || s (32 bytes)
    // Convert to DER format: SEQUENCE { INTEGER r, INTEGER s }

    const r = rawSignature.slice(0, 32);
    const s = rawSignature.slice(32, 64);

    // Helper to encode an integer in DER format
    const encodeInteger = (int: Uint8Array): Uint8Array => {
      // If high bit is set, prepend 0x00 to make it positive
      let value = int;
      if (int[0] >= 0x80) {
        value = new Uint8Array(int.length + 1);
        value[0] = 0x00;
        value.set(int, 1);
      }
      // Remove leading zeros (but keep at least one byte)
      let start = 0;
      while (start < value.length - 1 && value[start] === 0 && value[start + 1] < 0x80) {
        start++;
      }
      value = value.slice(start);

      // DER INTEGER: 0x02 <length> <value>
      const result = new Uint8Array(2 + value.length);
      result[0] = 0x02; // INTEGER tag
      result[1] = value.length;
      result.set(value, 2);
      return result;
    };

    const rDER = encodeInteger(r);
    const sDER = encodeInteger(s);

    // DER SEQUENCE: 0x30 <length> <rDER> <sDER>
    const result = new Uint8Array(2 + rDER.length + sDER.length);
    result[0] = 0x30; // SEQUENCE tag
    result[1] = rDER.length + sDER.length;
    result.set(rDER, 2);
    result.set(sDER, 2 + rDER.length);

    return result;
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
