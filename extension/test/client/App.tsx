/**
 * Magic Link Test Client
 *
 * Simple signup/signin form that tests:
 * - Email submission
 * - 5-digit code verification OR magic link flow
 * - Session polling for magic link completion
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

type AuthStep = 'email' | 'code' | 'waiting' | 'success';
type AuthType = 'code' | 'magic_link' | null;

function App() {
  const [step, setStep] = useState<AuthStep>('email');
  const [authType, setAuthType] = useState<AuthType>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Poll session status when waiting for magic link
  useEffect(() => {
    if (step !== 'waiting' || authType !== 'magic_link') return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (data.verified) {
          clearInterval(pollInterval);
          setStep('success');
          setMessage(`Successfully signed in as ${email}!`);
        }
      } catch (err) {
        console.error('Session poll error:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [step, authType, email]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setAuthType(data.type);
      setMessage(data.message);

      if (data.type === 'code') {
        setStep('code');
      } else {
        setStep('waiting');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setStep('success');
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStep('email');
    setAuthType(null);
    setEmail('');
    setCode('');
    setMessage('');
    setError('');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🔐 Magic Link Demo</h1>
        <p style={styles.subtitle}>Tests magic link automation with real emails</p>

        {/* Email Step */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} style={styles.form}>
            <label style={styles.label}>
              Email Address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={styles.input}
                disabled={isLoading}
              />
            </label>
            <button
              type="submit"
              style={{...styles.button, ...(isLoading ? styles.buttonDisabled : {})}}
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Sign In / Sign Up'}
            </button>
          </form>
        )}

        {/* Code Verification Step */}
        {step === 'code' && (
          <div>
            <div style={styles.messageBox}>
              <p style={styles.messageText}>📬 {message}</p>
            </div>
            <form onSubmit={handleCodeSubmit} style={styles.form}>
              <label style={styles.label}>
                Enter 5-Digit Code
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="12345"
                  required
                  pattern="\d{5}"
                  maxLength={5}
                  style={{...styles.input, ...styles.codeInput}}
                  disabled={isLoading}
                  autoFocus
                />
              </label>
              <button
                type="submit"
                style={{...styles.button, ...(isLoading ? styles.buttonDisabled : {})}}
                disabled={isLoading || code.length !== 5}
              >
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>
              <button
                type="button"
                onClick={reset}
                style={styles.linkButton}
              >
                ← Back
              </button>
            </form>
          </div>
        )}

        {/* Waiting for Magic Link */}
        {step === 'waiting' && (
          <div style={styles.waitingContainer}>
            <div style={styles.spinner}></div>
            <p style={styles.waitingText}>📬 {message}</p>
            <p style={styles.waitingSubtext}>
              Check your email and click the magic link.<br/>
              This page will automatically update when you sign in.
            </p>
            <button
              type="button"
              onClick={reset}
              style={styles.linkButton}
            >
              ← Back
            </button>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div style={styles.successContainer}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.successTitle}>Successfully Signed In!</h2>
            <p style={styles.successEmail}>{email}</p>
            <button
              type="button"
              onClick={reset}
              style={styles.button}
            >
              Sign in with different email
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={styles.errorBox}>
            <p style={styles.errorText}>⚠️ {error}</p>
          </div>
        )}

        {/* Info Box */}
        <div style={styles.infoBox}>
          <p style={styles.infoText}>
            <strong>How it works:</strong><br/>
            50% chance: You'll receive a 5-digit code<br/>
            50% chance: You'll receive a magic link
          </p>
        </div>
      </div>
    </div>
  );
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
  },
  card: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '32px',
    textAlign: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    margin: '0 0 30px 0',
    textAlign: 'center',
    color: '#666',
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
  },
  input: {
    padding: '12px 16px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  codeInput: {
    fontSize: '24px',
    letterSpacing: '8px',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  button: {
    padding: '14px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'transform 0.2s, opacity 0.2s',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#667eea',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '8px',
    textDecoration: 'underline',
  },
  messageBox: {
    background: '#f0f7ff',
    border: '2px solid #667eea',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '20px',
  },
  messageText: {
    margin: 0,
    color: '#667eea',
    fontSize: '14px',
    fontWeight: '600',
  },
  waitingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    padding: '20px 0',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #f0f0f0',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  waitingText: {
    margin: 0,
    color: '#667eea',
    fontSize: '16px',
    fontWeight: '600',
    textAlign: 'center',
  },
  waitingSubtext: {
    margin: 0,
    color: '#666',
    fontSize: '14px',
    textAlign: 'center',
    lineHeight: '1.6',
  },
  successContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    padding: '20px 0',
  },
  successIcon: {
    width: '80px',
    height: '80px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '48px',
    color: 'white',
    fontWeight: 'bold',
    animation: 'pop 0.5s ease-out',
  },
  successTitle: {
    margin: 0,
    fontSize: '24px',
    color: '#333',
  },
  successEmail: {
    margin: 0,
    fontSize: '16px',
    color: '#666',
    background: '#f0f0f0',
    padding: '8px 16px',
    borderRadius: '8px',
    fontFamily: 'monospace',
  },
  errorBox: {
    background: '#fff0f0',
    border: '2px solid #f44336',
    borderRadius: '10px',
    padding: '16px',
    marginTop: '20px',
  },
  errorText: {
    margin: 0,
    color: '#f44336',
    fontSize: '14px',
    fontWeight: '600',
  },
  infoBox: {
    background: '#f9f9f9',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    padding: '16px',
    marginTop: '30px',
  },
  infoText: {
    margin: 0,
    color: '#666',
    fontSize: '13px',
    lineHeight: '1.6',
  },
};

// Add keyframes via style tag
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes pop {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }

  input:focus {
    border-color: #667eea !important;
  }

  button:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  button:active:not(:disabled) {
    transform: translateY(0);
  }
`;
document.head.appendChild(styleSheet);

// Mount app
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
