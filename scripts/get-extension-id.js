#!/usr/bin/env node

/**
 * Compute Chrome extension ID from key.pem
 * Uses Chrome's algorithm: SHA256 of DER public key, first 16 bytes mapped to a-p
 */

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

// Extract public key in DER format from key.pem
const derPublicKey = execSync(
  'openssl rsa -in extension/key.pem -pubout -outform DER 2>/dev/null'
);

// SHA256 hash
const hash = createHash('sha256').update(derPublicKey).digest();

// Take first 16 bytes, map each byte to a-p (lowercase letters)
const extensionId = Array.from(hash.slice(0, 16))
  .map(byte => String.fromCharCode(97 + (byte % 26)))
  .join('');

console.log(extensionId);
