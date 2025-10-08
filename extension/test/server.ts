/**
 * WebAuthn Test Server
 *
 * Simple server implementing WebAuthn registration and authentication
 * Based on SimpleWebAuthn library
 */

import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
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

        const options = await generateRegistrationOptions({
          rpName,
          rpID,
          userID: user.id,
          userName: username,
          userDisplayName: email,
          attestationType: 'none',
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
          },
          excludeCredentials: user.credentials.map(cred => ({
            id: cred.credentialID,
            type: 'public-key',
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
          const {
            credentialID,
            credentialPublicKey,
            counter,
          } = verification.registrationInfo;

          const newAuthenticator: Authenticator = {
            credentialID,
            credentialPublicKey,
            counter,
            transports: attResp.response.transports,
          };

          user.credentials.push(newAuthenticator);

          // Clean up challenge
          challenges.delete(sessionId);

          console.log(`✓ Registered credential for ${username}:`, {
            credentialID: Buffer.from(credentialID).toString('base64'),
          });

          return Response.json({
            verified: true,
            userId: user.id,
            credentialId: Buffer.from(credentialID).toString('base64'),
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
          allowCredentials: user.credentials.map(cred => ({
            id: cred.credentialID,
            type: 'public-key',
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

        // Find the authenticator
        const credentialID = authResp.rawId;
        const authenticator = user.credentials.find(cred =>
          Buffer.from(cred.credentialID).equals(Buffer.from(credentialID, 'base64'))
        );

        if (!authenticator) {
          return Response.json({ error: 'Authenticator not found' }, { status: 400, headers });
        }

        const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
          response: authResp,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          authenticator: {
            credentialID: authenticator.credentialID,
            credentialPublicKey: authenticator.credentialPublicKey,
            counter: authenticator.counter,
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
