/**
 * Test Automation Script
 *
 * Demonstrates the smart GDPR modal detection:
 * 1. First visit → Detects and dismisses modal
 * 2. Second visit → Skips detection (cookies exist)
 */

import { spawn } from 'bun';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EXTENSION_PATH = '/Users/rpm/agent-browser/extension/public';
const TEST_URL = 'http://localhost:3500';

console.log(`
╔════════════════════════════════════════════════════════════╗
║        GDPR Auto-Modal Detection Test Suite               ║
╚════════════════════════════════════════════════════════════╝

📋 Test Scenario:
   1. Launch Chrome with extension
   2. Navigate to homepage (no cookies)
   3. GDPR banner appears
   4. Auto-modal detects and clicks "Accept All"
   5. Navigate to /story page
   6. GDPR banner does NOT appear (cookies exist)
   7. Auto-modal SKIPS check (smart detection!)

🔧 Prerequisites:
   ✓ Server running on http://localhost:3500
   ✓ Extension built in ../public
   ✓ Chrome installed

🚀 Starting test...
`);

async function runTest() {
  console.log('📍 Step 1: Starting Chrome with extension...\n');

  const chrome = spawn({
    cmd: [
      CHROME_PATH,
      `--load-extension=${EXTENSION_PATH}`,
      '--new-window',
      '--auto-open-devtools-for-tabs',
      TEST_URL,
    ],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  console.log(`
✅ Chrome launched!

📖 Manual Test Steps:

1️⃣  FIRST VISIT (Homepage):
   • Browser opens to http://localhost:3500/
   • Watch debug console (top-right corner)
   • GDPR banner should appear after 500ms
   • Auto-modal should detect it
   • Click "Accept All" (auto or manual)
   • Check debug console for:
     ✓ "GDPR banner shown"
     ✓ "Modal detected"
     ✓ "Cookie set: gdpr_consent=accepted"

2️⃣  SECOND VISIT (Story page):
   • Click "Featured Story" in nav
   • Navigate to http://localhost:3500/story
   • Check debug console shows:
     ✓ "Cookies exist: true"
     ✓ "GDPR consent: accepted"
     ✓ "Consent already given - banner skipped"
   • GDPR banner should NOT appear
   • Auto-modal should NOT check (smart!)

3️⃣  RESET TEST:
   • Click "Clear Cookies (Reset)" in nav
   • Page reloads with no cookies
   • GDPR banner appears again
   • Repeat test

📊 Check Console Output:
   • Open DevTools (F12)
   • Check "Console" tab for auto-modal logs
   • Look for "[Auto Modal]" prefixed messages

Press Ctrl+C to stop test server when done.
`);

  await chrome.exited;
  console.log('\n✅ Test completed!');
}

// Check if server is running
try {
  const response = await fetch(TEST_URL);
  if (response.ok) {
    await runTest();
  }
} catch (error) {
  console.error(`
❌ Error: Test server not running!

Please start the server first:
  cd extension/test/gdpr
  bun run dev

Then run this test again:
  bun run test
`);
  process.exit(1);
}
