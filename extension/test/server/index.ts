/**
 * Magic Link Test Server
 *
 * Tests magic link automation with real email sending
 * - Randomly sends 5-digit code OR magic link
 * - Uses Resend API for email delivery
 * - Serves React client and API endpoints
 */

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'test@auth.mail.kontext.dev';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3456';

if (!RESEND_API_KEY) {
  console.error('Error: RESEND_API_KEY environment variable is required');
  console.error('Set it with: export RESEND_API_KEY=re_...');
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

// In-memory storage for demo
interface AuthSession {
  email: string;
  code?: string;
  token?: string;
  type: 'code' | 'magic_link';
  createdAt: number;
  verified: boolean;
}

const sessions = new Map<string, AuthSession>();

// Generate random 5-digit code
function generateCode(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// Generate random token for magic link
function generateToken(): string {
  return Math.random().toString(36).substring(2) +
         Math.random().toString(36).substring(2) +
         Math.random().toString(36).substring(2);
}

// Clean up old sessions (older than 15 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [email, session] of sessions.entries()) {
    if (now - session.createdAt > 15 * 60 * 1000) {
      sessions.delete(email);
      console.log(`[Cleanup] Removed old session for ${email}`);
    }
  }
}, 60 * 1000);

const server = Bun.serve({
  port: 3456,

  routes: {
    // Serve React client
    "/": {
      GET: () => new Response(Bun.file('../client/index.html'))
    },

    // API: Submit email (signup/signin)
    "/api/auth": {
      POST: async (req) => {
        try {
          const { email } = await req.json();

          if (!email || !email.includes('@')) {
            return Response.json({ error: 'Invalid email' }, { status: 400 });
          }

          console.log(`\n[Auth] Request for ${email}`);

          // Random: 50% code, 50% magic link
          const useCode = Math.random() < 0.5;
          const type = useCode ? 'code' : 'magic_link';

          let session: AuthSession;

          if (useCode) {
            // Generate 5-digit code
            const code = generateCode();
            session = {
              email,
              code,
              type: 'code',
              createdAt: Date.now(),
              verified: false,
            };

            console.log(`[Auth] Sending 5-digit code: ${code}`);

            // Send email with code
            await resend.emails.send({
              from: FROM_EMAIL,
              to: email,
              subject: 'Your verification code',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Your Verification Code</h2>
                  <p>Enter this code to sign in:</p>
                  <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
                    ${code}
                  </div>
                  <p style="color: #666; font-size: 14px;">This code will expire in 15 minutes.</p>
                </div>
              `,
            });

          } else {
            // Generate magic link
            const token = generateToken();
            session = {
              email,
              token,
              type: 'magic_link',
              createdAt: Date.now(),
              verified: false,
            };

            const magicLink = `${BASE_URL}/verify?token=${token}`;
            console.log(`[Auth] Sending magic link: ${magicLink}`);

            // Send email with magic link
            await resend.emails.send({
              from: FROM_EMAIL,
              to: email,
              subject: 'Sign in with magic link',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Sign In to Your Account</h2>
                  <p>Click the link below to sign in:</p>
                  <div style="margin: 30px 0;">
                    <a href="${magicLink}" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                      Sign In
                    </a>
                  </div>
                  <p style="color: #666; font-size: 14px;">Or copy this link:</p>
                  <p style="background: #f0f0f0; padding: 10px; word-break: break-all; font-size: 12px;">
                    ${magicLink}
                  </p>
                  <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes.</p>
                </div>
              `,
            });
          }

          // Store session
          sessions.set(email, session);

          return Response.json({
            success: true,
            type,
            message: type === 'code'
              ? 'Check your email for a 5-digit code'
              : 'Check your email for a magic link',
          });

        } catch (error) {
          console.error('[Auth] Error:', error);
          return Response.json({
            error: 'Failed to send email',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }
    },

    // API: Verify code
    "/api/verify-code": {
      POST: async (req) => {
        try {
          const { email, code } = await req.json();

          const session = sessions.get(email);

          if (!session) {
            return Response.json({ error: 'No session found' }, { status: 404 });
          }

          if (session.type !== 'code') {
            return Response.json({ error: 'Session uses magic link, not code' }, { status: 400 });
          }

          if (session.code !== code) {
            return Response.json({ error: 'Invalid code' }, { status: 401 });
          }

          // Mark as verified
          session.verified = true;
          console.log(`[Verify] Code verified for ${email}`);

          return Response.json({
            success: true,
            message: 'Successfully verified!',
            email,
          });

        } catch (error) {
          console.error('[Verify Code] Error:', error);
          return Response.json({ error: 'Verification failed' }, { status: 500 });
        }
      }
    },

    // Magic link verification endpoint
    "/verify": {
      GET: (req) => {
        const url = new URL(req.url);
        const token = url.searchParams.get('token');

        if (!token) {
          return new Response(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Error</title>
                <style>
                  body {
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 50px auto;
                    padding: 20px;
                    text-align: center;
                  }
                  .error { color: #d32f2f; }
                </style>
              </head>
              <body>
                <h1 class="error">❌ Invalid Link</h1>
                <p>This magic link is invalid or has expired.</p>
              </body>
            </html>
          `, {
            headers: { 'Content-Type': 'text/html' }
          });
        }

        // Find session by token
        let foundSession: AuthSession | null = null;
        for (const session of sessions.values()) {
          if (session.token === token) {
            foundSession = session;
            break;
          }
        }

        if (!foundSession) {
          return new Response(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Error</title>
                <style>
                  body {
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 50px auto;
                    padding: 20px;
                    text-align: center;
                  }
                  .error { color: #d32f2f; }
                </style>
              </head>
              <body>
                <h1 class="error">❌ Link Expired</h1>
                <p>This magic link has expired or was already used.</p>
              </body>
            </html>
          `, {
            headers: { 'Content-Type': 'text/html' }
          });
        }

        // Mark as verified
        foundSession.verified = true;
        console.log(`[Verify] Magic link verified for ${foundSession.email}`);

        return new Response(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Success!</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  max-width: 600px;
                  margin: 50px auto;
                  padding: 20px;
                  text-align: center;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  flex-direction: column;
                }
                .success {
                  background: rgba(255, 255, 255, 0.1);
                  backdrop-filter: blur(10px);
                  border-radius: 20px;
                  padding: 40px;
                  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                }
                h1 {
                  font-size: 48px;
                  margin: 20px 0;
                }
                .email {
                  background: rgba(255, 255, 255, 0.2);
                  padding: 10px 20px;
                  border-radius: 10px;
                  margin: 20px 0;
                  font-family: 'Courier New', monospace;
                }
                .checkmark {
                  font-size: 80px;
                  animation: pop 0.5s ease-out;
                }
                @keyframes pop {
                  0% { transform: scale(0); }
                  50% { transform: scale(1.2); }
                  100% { transform: scale(1); }
                }
              </style>
            </head>
            <body>
              <div class="success">
                <div class="checkmark">✓</div>
                <h1>Successfully Signed In!</h1>
                <p>Welcome back,</p>
                <div class="email">${foundSession.email}</div>
                <p style="opacity: 0.8; margin-top: 30px;">You can close this tab now.</p>
              </div>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    },

    // API: Check session status
    "/api/session": {
      POST: async (req) => {
        try {
          const { email } = await req.json();
          const session = sessions.get(email);

          if (!session) {
            return Response.json({ verified: false });
          }

          return Response.json({
            verified: session.verified,
            type: session.type,
          });

        } catch (error) {
          return Response.json({ verified: false });
        }
      }
    },
  },

  development: {
    hmr: true,
  },
});

console.log(`
╔════════════════════════════════════════════════════════╗
║  🔗 Magic Link Test Server                            ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Server running at: http://localhost:${server.port}         ║
║                                                        ║
║  Endpoints:                                            ║
║  • POST /api/auth            - Submit email            ║
║  • POST /api/verify-code     - Verify 5-digit code     ║
║  • GET  /verify?token=...    - Magic link endpoint     ║
║  • POST /api/session         - Check auth status       ║
║                                                        ║
║  Email Provider: ${FROM_EMAIL}            ║
║                                                        ║
║  Random Mode:                                          ║
║  • 50% chance: 5-digit code                           ║
║  • 50% chance: Magic link                             ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
`);
