#!/usr/bin/env node

/**
 * Test NMH installation by simulating Chrome's native messaging protocol
 *
 * This script:
 * 1. Reads extension ID from extension/EXTENSION_ID
 * 2. Spawns the NMH binary
 * 3. Sends a message via stdin
 * 4. Reads response from stdout
 * 5. Verifies server started
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m'; // No Color

console.log('======================================');
console.log('Testing NMH Installation');
console.log('======================================\n');

// Check extension ID exists
const extensionIdPath = join(rootDir, 'extension/EXTENSION_ID');
if (!existsSync(extensionIdPath)) {
  console.error(`${RED}✗ extension/EXTENSION_ID not found${NC}`);
  console.log('Run: bun run install-nmh\n');
  process.exit(1);
}

const extensionId = readFileSync(extensionIdPath, 'utf8').trim();
console.log(`Extension ID: ${extensionId}\n`);

// Check NMH binary exists
const nmhPath = '/usr/local/bin/agent-browser-nmh';
if (!existsSync(nmhPath)) {
  console.error(`${RED}✗ NMH binary not found at ${nmhPath}${NC}`);
  console.log('Run: bun run install-nmh\n');
  process.exit(1);
}

console.log(`${GREEN}✓ NMH binary found${NC}\n`);

// Spawn NMH process
console.log('Spawning NMH process...');
const nmh = spawn(nmhPath, [], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let response = '';

nmh.stdout.on('data', (data) => {
  response += data.toString();
});

nmh.stderr.on('data', (data) => {
  console.log('NMH stderr:', data.toString());
});

nmh.on('error', (error) => {
  console.error(`${RED}✗ Failed to spawn NMH: ${error.message}${NC}\n`);
  process.exit(1);
});

nmh.on('close', (code) => {
  if (code !== 0) {
    console.error(`${RED}✗ NMH exited with code ${code}${NC}\n`);
    process.exit(1);
  }

  // Parse response
  try {
    // Chrome's native messaging format: 4-byte length prefix + JSON
    const lengthBuffer = Buffer.from(response, 'binary').slice(0, 4);
    const messageLength = lengthBuffer.readUInt32LE(0);
    const messageBuffer = Buffer.from(response, 'binary').slice(4, 4 + messageLength);
    const message = JSON.parse(messageBuffer.toString('utf8'));

    console.log('\nNMH Response:');
    console.log(JSON.stringify(message, null, 2));
    console.log();

    if (message.ok) {
      console.log(`${GREEN}✓ Server is running${NC}`);
      console.log(`  Host: ${message.host}`);
      console.log(`  Port: ${message.port}`);
      console.log(`  Scheme: ${message.scheme}`);

      if (message.logs) {
        console.log('\nLogs:');
        console.log(message.logs);
      }

      console.log('\n======================================');
      console.log(`${GREEN}NMH test passed!${NC}`);
      console.log('======================================\n');

      console.log('Next steps:');
      console.log('1. Load extension in Chrome');
      console.log('2. Extension will auto-call NMH');
      console.log('3. Server will auto-start');
      console.log('4. Extension badge will show ✓');
      console.log();
    } else {
      console.error(`${RED}✗ NMH reported error: ${message.error}${NC}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`${RED}✗ Failed to parse NMH response: ${error.message}${NC}\n`);
    console.log('Raw response:', response);
    process.exit(1);
  }
});

// Send message to NMH
const request = { cmd: 'ensure_server' };
const requestJson = JSON.stringify(request);
const requestBuffer = Buffer.from(requestJson, 'utf8');
const lengthBuffer = Buffer.allocUnsafe(4);
lengthBuffer.writeUInt32LE(requestBuffer.length, 0);

nmh.stdin.write(lengthBuffer);
nmh.stdin.write(requestBuffer);
nmh.stdin.end();

console.log('Sent request:', request);
console.log('Waiting for response...\n');
