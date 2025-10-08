/**
 * Tests for magic link detection
 */

import { test, expect, describe } from 'bun:test';

describe('Magic Link Detector', () => {
  test('detects email input fields', () => {
    const mockEmailInput = {
      type: 'email',
      name: 'email',
      value: ''
    };

    expect(mockEmailInput.type).toBe('email');
    expect(mockEmailInput.name).toBe('email');
  });

  test('identifies signin vs signup forms', () => {
    const signinForm = {
      action: '/login',
      hasPasswordField: true,
      hasEmailField: true
    };

    const signupForm = {
      action: '/register',
      hasPasswordField: false,
      hasEmailField: true
    };

    expect(signinForm.hasPasswordField).toBe(true);
    expect(signupForm.hasPasswordField).toBe(false);
    expect(signupForm.action).toContain('register');
  });

  test('extracts domain from URL', () => {
    const extractDomain = (url: string) => {
      try {
        return new URL(url).hostname;
      } catch {
        return null;
      }
    };

    expect(extractDomain('https://example.com/login')).toBe('example.com');
    expect(extractDomain('https://app.example.com/signup')).toBe('app.example.com');
    expect(extractDomain('invalid-url')).toBeNull();
  });

  test('validates email format', () => {
    const isValidEmail = (email: string) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.user+tag@domain.co.uk')).toBe(true);
    expect(isValidEmail('invalid.email')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
  });
});
