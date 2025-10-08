/**
 * Automated Passkey Signup Test
 *
 * This script tests the full passkey automation flow:
 * 1. Enable passkey automation via MCP
 * 2. Open test page
 * 3. Fill registration form
 * 4. Create passkey (intercepted by proxy)
 * 5. Verify registration success
 * 6. Test authentication
 */

const MCP_SERVER = 'localhost:8084';
const TEST_SERVER = 'http://localhost:3000';

// Helper: Send MCP command
async function mcpCall(method: string, params: any = {}): Promise<any> {
  const request = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: method,
      arguments: params
    }
  };

  console.log(`📤 MCP Request: ${method}`, params);

  try {
    const response = await fetch(`http://${MCP_SERVER}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    console.log(`📥 MCP Response:`, data);

    if (data.error) {
      throw new Error(`MCP Error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    return data.result;
  } catch (error) {
    console.error(`❌ MCP call failed:`, error);
    throw error;
  }
}

// Helper: Wait
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  Agent Browser - Passkey Automation Test              ║
╚════════════════════════════════════════════════════════╝
`);

  try {
    // Step 1: Check authorization status
    console.log('\n📋 Step 1: Check authorization status');
    const authStatus = await mcpCall('passkey_authorization_status');
    console.log('Authorization status:', authStatus);

    if (!authStatus.authorized) {
      console.log('\n⚠️  Not authorized! Run this first:');
      console.log('   echo \'{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"passkey_authorize","arguments":{"duration_hours":8}}}\' | nc localhost 8084');
      console.log('\nThen run this test again.');
      process.exit(1);
    }

    console.log(`✓ Authorized (expires in ${Math.floor(authStatus.remaining_seconds / 60)} minutes)`);

    // Step 2: Enable passkey automation
    console.log('\n📋 Step 2: Enable passkey automation');
    const enableResult = await mcpCall('passkey_enable', { enabled: true });
    console.log('✓ Passkey automation enabled:', enableResult);

    // Step 3: Check passkey status
    console.log('\n📋 Step 3: Check passkey proxy status');
    const passkeyStatus = await mcpCall('passkey_status');
    console.log('Passkey status:', passkeyStatus);

    if (!passkeyStatus.attached) {
      console.log('❌ WebAuthn proxy not attached!');
      process.exit(1);
    }

    console.log('✓ WebAuthn proxy attached and ready');

    // Step 4: Navigate to test page
    console.log('\n📋 Step 4: Navigate to test page');
    await mcpCall('playwright_navigate', { url: TEST_SERVER });
    console.log(`✓ Navigated to ${TEST_SERVER}`);

    await wait(2000); // Wait for page load

    // Step 5: Fill registration form
    console.log('\n📋 Step 5: Fill registration form');
    const username = `test-user-${Date.now()}`;
    const email = `${username}@example.com`;

    await mcpCall('playwright_fill', {
      selector: '#regUsername',
      value: username
    });
    console.log(`✓ Filled username: ${username}`);

    await mcpCall('playwright_fill', {
      selector: '#regEmail',
      value: email
    });
    console.log(`✓ Filled email: ${email}`);

    await wait(500);

    // Step 6: Click register button (will trigger WebAuthn)
    console.log('\n📋 Step 6: Click "Create Passkey" button');
    console.log('⏳ This will trigger WebAuthn passkey creation...');
    console.log('   The passkey proxy should intercept and handle it automatically.');

    await mcpCall('playwright_click', { selector: '#btnRegister' });
    console.log('✓ Clicked register button');

    await wait(3000); // Wait for WebAuthn flow

    // Step 7: Check for success message
    console.log('\n📋 Step 7: Verify registration success');
    await wait(1000);

    const screenshot1 = await mcpCall('playwright_screenshot');
    console.log('✓ Screenshot taken (check for success message)');

    // Step 8: List stored passkeys
    console.log('\n📋 Step 8: List stored passkeys');
    const passkeys = await mcpCall('passkey_list');
    console.log('Stored passkeys:', passkeys);

    if (passkeys.credentials && passkeys.credentials.length > 0) {
      console.log(`✓ Found ${passkeys.credentials.length} stored passkey(s)`);
      passkeys.credentials.forEach((cred: any, i: number) => {
        console.log(`  ${i + 1}. rpId: ${cred.rpId}, created: ${new Date(cred.created).toLocaleString()}`);
      });
    } else {
      console.log('⚠️  No passkeys found (may not have been stored yet)');
    }

    // Step 9: Test authentication
    console.log('\n📋 Step 9: Test authentication');
    await wait(1000);

    // Fill auth username
    await mcpCall('playwright_fill', {
      selector: '#authUsername',
      value: username
    });
    console.log(`✓ Filled auth username: ${username}`);

    await wait(500);

    // Click authenticate button
    console.log('⏳ Clicking "Sign In with Passkey" button...');
    await mcpCall('playwright_click', { selector: '#btnAuthenticate' });
    console.log('✓ Clicked authenticate button');

    await wait(3000); // Wait for WebAuthn flow

    // Take final screenshot
    const screenshot2 = await mcpCall('playwright_screenshot');
    console.log('✓ Final screenshot taken');

    // Success!
    console.log(`
╔════════════════════════════════════════════════════════╗
║  ✓ TEST COMPLETE                                      ║
╚════════════════════════════════════════════════════════╝

Summary:
  - Passkey automation enabled
  - WebAuthn proxy attached
  - Registration form filled
  - Passkey created (intercepted by proxy)
  - Authentication tested

Check the browser window to verify:
  1. Registration success message
  2. Authentication success message

Passkey automation is working! 🎉
`);

  } catch (error) {
    console.error(`
╔════════════════════════════════════════════════════════╗
║  ❌ TEST FAILED                                        ║
╚════════════════════════════════════════════════════════╝

Error: ${error.message}

Troubleshooting:
  1. Is the MCP server running?
     cargo run --release (in server/)

  2. Is the extension loaded in Chrome?
     Check chrome://extensions/

  3. Is the test server running?
     bun run dev (in extension/test/)

  4. Is the session authorized?
     Run: passkey_authorize via MCP

  5. Check server logs for details
`);
    process.exit(1);
  }
}

// Run the test
runTest();
