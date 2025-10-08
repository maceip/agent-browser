/**
 * WebAuthn Test Server
 *
 * Simple server implementing WebAuthn registration and authentication
 * Based on SimpleWebAuthn library
 */

import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';

// In-memory storage (for demo purposes)
interface User {
  id: string;
  username: string;
  email: string;
  credentials: Authenticator[];
}

interface Authenticator {
  credentialID: Uint8Array;
  credentialPublicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransport[];
}

const users: Map<string, User> = new Map();
const challenges: Map<string, string> = new Map(); // sessionId -> challenge

// Server configuration
const rpName = 'Agent Browser Demo';
const rpID = 'localhost';
const origin = `http://localhost:3000`;

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    // Serve HTML page
    if (path === '/' || path === '/index.html') {
      const html = await Bun.file('passkey-demo-client.html').text();
      return new Response(html, {
        headers: { ...headers, 'Content-Type': 'text/html' },
      });
    }

    // Generate registration options
    if (path === '/generate-registration-options' && req.method === 'POST') {
      try {
        const body = await req.json();
        const { username, email } = body;

        if (!username || !email) {
          return Response.json({ error: 'Username and email required' }, { status: 400, headers });
        }

        // Create or get user
        let user = Array.from(users.values()).find(u => u.username === username);
        if (!user) {
          user = {
            id: crypto.randomUUID(),
            username,
            email,
            credentials: [],
          };
          users.set(user.id, user);
        }

        // Convert user.id string to Uint8Array for SimpleWebAuthn v11+
        const userIdBuffer = new TextEncoder().encode(user.id);

        const options = await generateRegistrationOptions({
          rpName,
          rpID,
          userID: userIdBuffer,
          userName: username,
          userDisplayName: email,
          attestationType: 'none',
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
          },
          excludeCredentials: user.credentials
            .filter(cred => cred.credentialID) // Filter out invalid credentials
            .map(cred => ({
              id: isoBase64URL.fromBuffer(cred.credentialID),
              transports: cred.transports,
            })),
        });

        // Store challenge for verification
        const sessionId = crypto.randomUUID();
        challenges.set(sessionId, options.challenge);

        return Response.json({ ...options, sessionId }, { headers });
      } catch (error) {
        console.error('Registration options error:', error);
        return Response.json({ error: error.message }, { status: 500, headers });
      }
    }

    // Verify registration
    if (path === '/verify-registration' && req.method === 'POST') {
      try {
        const body = await req.json();
        const { sessionId, username, response: attResp } = body;

        const expectedChallenge = challenges.get(sessionId);
        if (!expectedChallenge) {
          return Response.json({ error: 'Challenge not found or expired' }, { status: 400, headers });
        }

        const user = Array.from(users.values()).find(u => u.username === username);
        if (!user) {
          return Response.json({ error: 'User not found' }, { status: 400, headers });
        }

        const verification: VerifiedRegistrationResponse = await verifyRegistrationResponse({
          response: attResp,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
        });

        if (verification.verified && verification.registrationInfo) {
          const { credential } = verification.registrationInfo;

          if (!credential || !credential.id) {
            console.error('[ERROR] No credential found in registrationInfo');
            return Response.json({ verified: false, error: 'Missing credential' }, { headers });
          }

          // In SimpleWebAuthn v11+:
          // - credential.id is a base64url STRING
          // - credential.publicKey is a Uint8Array
          // - credential.counter is a number
          // - credential.transports is an array of strings

          // Convert credential.id (base64url string) back to Uint8Array for storage
          const credentialIDBytes = Uint8Array.from(
            atob(credential.id.replace(/-/g, '+').replace(/_/g, '/')),
            c => c.charCodeAt(0)
          );

          const newAuthenticator: Authenticator = {
            credentialID: credentialIDBytes,
            credentialPublicKey: credential.publicKey,
            counter: credential.counter,
            transports: credential.transports,
          };

          user.credentials.push(newAuthenticator);

          // Clean up challenge
          challenges.delete(sessionId);

          console.log(`✓ Registered credential for ${username}:`, {
            credentialID: credential.id,
          });

          return Response.json({
            verified: true,
            userId: user.id,
            credentialId: credential.id,
          }, { headers });
        }

        return Response.json({ verified: false, error: 'Verification failed' }, { headers });
      } catch (error) {
        console.error('Registration verification error:', error);
        return Response.json({ error: error.message }, { status: 500, headers });
      }
    }

    // Generate authentication options
    if (path === '/generate-authentication-options' && req.method === 'POST') {
      try {
        const body = await req.json();
        const { username } = body;

        const user = Array.from(users.values()).find(u => u.username === username);
        if (!user || user.credentials.length === 0) {
          return Response.json({ error: 'User not found or no credentials' }, { status: 400, headers });
        }

        const options = await generateAuthenticationOptions({
          rpID,
          allowCredentials: user.credentials
            .filter(cred => cred.credentialID) // Filter out invalid credentials
            .map(cred => ({
              id: isoBase64URL.fromBuffer(cred.credentialID),
              transports: cred.transports,
            })),
          userVerification: 'preferred',
        });

        // Store challenge
        const sessionId = crypto.randomUUID();
        challenges.set(sessionId, options.challenge);

        return Response.json({ ...options, sessionId }, { headers });
      } catch (error) {
        console.error('Authentication options error:', error);
        return Response.json({ error: error.message }, { status: 500, headers });
      }
    }

    // Verify authentication
    if (path === '/verify-authentication' && req.method === 'POST') {
      try {
        const body = await req.json();
        const { sessionId, username, response: authResp } = body;

        const expectedChallenge = challenges.get(sessionId);
        if (!expectedChallenge) {
          return Response.json({ error: 'Challenge not found or expired' }, { status: 400, headers });
        }

        const user = Array.from(users.values()).find(u => u.username === username);
        if (!user) {
          return Response.json({ error: 'User not found' }, { status: 400, headers });
        }

        // Find the authenticator - authResp.rawId is a base64url string in v11
        const rawIdBase64url = authResp.rawId;

        // Convert base64url string to Uint8Array for comparison
        const rawIdBytes = Uint8Array.from(
          atob(rawIdBase64url.replace(/-/g, '+').replace(/_/g, '/')),
          c => c.charCodeAt(0)
        );

        const authenticator = user.credentials.find(cred => {
          if (cred.credentialID.length !== rawIdBytes.length) return false;
          for (let i = 0; i < cred.credentialID.length; i++) {
            if (cred.credentialID[i] !== rawIdBytes[i]) return false;
          }
          return true;
        });

        if (!authenticator) {
          console.error('[ERROR] Authenticator not found for rawId:', rawIdBase64url);
          return Response.json({ error: 'Authenticator not found' }, { status: 400, headers });
        }

        const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
          response: authResp,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: {
            id: isoBase64URL.fromBuffer(authenticator.credentialID),
            publicKey: authenticator.credentialPublicKey,
            counter: authenticator.counter,
            transports: authenticator.transports,
          },
        });

        if (verification.verified) {
          // Update counter
          authenticator.counter = verification.authenticationInfo.newCounter;

          // Clean up challenge
          challenges.delete(sessionId);

          console.log(`✓ Authenticated ${username}`);

          return Response.json({
            verified: true,
            userId: user.id,
          }, { headers });
        }

        return Response.json({ verified: false, error: 'Verification failed' }, { headers });
      } catch (error) {
        console.error('Authentication verification error:', error);
        return Response.json({ error: error.message }, { status: 500, headers });
      }
    }

    // Get users (for debugging)
    if (path === '/users' && req.method === 'GET') {
      const userList = Array.from(users.values()).map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        credentialCount: u.credentials.length,
      }));
      return Response.json(userList, { headers });
    }

    // Clear all users (for debugging)
    if (path === '/users' && req.method === 'DELETE') {
      users.clear();
      challenges.clear();
      console.log('🗑️  Cleared all users and challenges');
      return Response.json({ success: true, message: 'All users cleared' }, { headers });
    }

    return new Response('Not Found', { status: 404, headers });
  },
});

console.log(`
🔐 WebAuthn Test Server

Server running at: ${origin}
Open in browser:   ${origin}

Endpoints:
  POST /generate-registration-options
  POST /verify-registration
  POST /generate-authentication-options
  POST /verify-authentication
  GET  /users (debug)
`);
