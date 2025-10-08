/**
 * Background script - WebSocket client and message routing
 *
 * - Connect WebSocket to localhost:8085
 * - Route messages to correct tab
 * - Auto-inject content script if dead
 * - Reconnect if disconnected
 * - Handle WebAuthn passkey automation
 */

import { WebAuthnProxy } from '../lib/webauthn/proxy';
import { getEmailInboxAutomation } from '../lib/automation/email-inbox';

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string;
  method: string;
  params: Record<string, any>;
}

interface Response {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

interface PendingRequest {
  resolve: (value: Response) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// ============================================================================
// State
// ============================================================================

let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000;

const pending = new Map<string, PendingRequest>();

// Badge state management
type ServerStatus = 'starting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
type CommandType = 'navigate' | 'click' | 'type' | 'wait' | 'screenshot' | null;
type ErrorType = 'timeout' | 'injection_failed' | 'server_error' | null;
type LlmStatus = 'idle' | 'downloading' | 'initializing' | 'ready' | 'generating' | 'error';
type EmailStatus = 'not_configured' | 'configured' | 'active';
type MagicLinkStatus = 'idle' | 'detected' | 'checking_inbox' | 'found' | 'clicking';

// Animation state for long-running initialization
let llmInitAnimationInterval: ReturnType<typeof setInterval> | null = null;
let llmInitAnimationFrame = 0;

// Icon animation removed - using static icon from manifest

interface BadgeState {
  serverStatus: ServerStatus;
  activeCommand: CommandType;
  errorType: ErrorType;
  reconnectAttempt: number;
  errorMessage?: string;
  llmStatus: LlmStatus;
  llmProgress: number; // 0-1
  llmDownloadedBytes: number;
  llmTotalBytes: number;
  emailStatus: EmailStatus;
  emailAddress?: string;
  emailProvider?: string;
  magicLinkStatus: MagicLinkStatus;
  magicLinkDomain?: string;
}

let badgeState: BadgeState = {
  serverStatus: 'starting',
  activeCommand: null,
  errorType: null,
  reconnectAttempt: 0,
  llmStatus: 'idle',
  llmProgress: 0,
  llmDownloadedBytes: 0,
  llmTotalBytes: 0,
  emailStatus: 'not_configured',
  magicLinkStatus: 'idle',
};

// Tab groups
let automationTabGroupId: number | null = null;

// WebAuthn proxy
let webAuthnProxy: WebAuthnProxy | null = null;

// Offscreen document
let offscreenReady = false;

// Icon animation removed - using static icon from manifest only

// ============================================================================
// Badge Management
// ============================================================================

function updateBadge() {
  // Priority: Error > Onboarding > Server Status (disconnected/error/reconnecting) > Magic Link > LLM > Active Command > Email Identity > Server Status (connected/starting)

  if (badgeState.errorType) {
    // Error state
    chrome.action.setBadgeText({ text: '⚠' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    const errorMsg = badgeState.errorMessage || 'Unknown error';
    const errorDetails = [
      '⚠️ ERROR',
      `Type: ${badgeState.errorType}`,
      `Message: ${errorMsg}`,
      `Time: ${new Date().toLocaleTimeString()}`,
      '',
      'Check browser console (F12) for details'
    ].join('\n');
    chrome.action.setTitle({ title: errorDetails });
    return;
  }

  // Onboarding needed badge (highest priority after errors)
  if (badgeState.emailStatus === 'not_configured') {
    chrome.action.setBadgeText({ text: '⚠️' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff6b35' }); // Orange
    const onboardingInfo = [
      '👋 SETUP REQUIRED',
      '',
      'Email automation is not configured',
      '',
      '→ Click this icon to start setup',
      '→ You\'ll configure your email provider',
      '→ Enable automatic magic link login',
      '',
      'Setup takes ~2 minutes'
    ].join('\n');
    chrome.action.setTitle({ title: onboardingInfo });
    return;
  }

  // Critical server status (disconnected, error, reconnecting) - must be visible!
  if (badgeState.serverStatus === 'disconnected') {
    chrome.action.setBadgeText({ text: '✗' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    const disconnectedInfo = [
      '✗ DISCONNECTED',
      '',
      'MCP Server: Not connected',
      'WebSocket: Closed',
      '',
      'Action: Start the Rust server',
      'Command: cargo run',
      '',
      'Extension will auto-reconnect when server starts'
    ].join('\n');
    chrome.action.setTitle({ title: disconnectedInfo });
    return;
  }

  if (badgeState.serverStatus === 'error') {
    chrome.action.setBadgeText({ text: '✗' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    const serverErrorInfo = [
      '✗ SERVER ERROR',
      '',
      `Error: ${badgeState.errorMessage || 'Unknown error'}`,
      `Time: ${new Date().toLocaleTimeString()}`,
      '',
      'Check if the Rust server is running',
      'Try restarting the server',
      '',
      'See console for details'
    ].join('\n');
    chrome.action.setTitle({ title: serverErrorInfo });
    return;
  }

  if (badgeState.serverStatus === 'reconnecting') {
    chrome.action.setBadgeText({ text: `↻${badgeState.reconnectAttempt}` });
    chrome.action.setBadgeBackgroundColor({ color: '#eab308' });
    const reconnectInfo = [
      `↻ RECONNECTING`,
      '',
      `Attempt: ${badgeState.reconnectAttempt} / ${MAX_RECONNECT_ATTEMPTS}`,
      `Time: ${new Date().toLocaleTimeString()}`,
      '',
      'Status: Trying to reconnect to MCP server',
      'Websocket connection lost',
      '',
      'Will retry automatically'
    ].join('\n');
    chrome.action.setTitle({ title: reconnectInfo });
    return;
  }

  // Magic link automation states (high priority)
  if (badgeState.magicLinkStatus !== 'idle') {
    switch (badgeState.magicLinkStatus) {
      case 'detected':
        chrome.action.setBadgeText({ text: '🔗' });
        chrome.action.setBadgeBackgroundColor({ color: '#ff9500' }); // Orange
        const detectedInfo = [
          '🔗 MAGIC LINK DETECTED',
          '',
          `Email: ${badgeState.emailAddress || 'Unknown'}`,
          `Domain: ${badgeState.magicLinkDomain || 'Unknown'}`,
          `Time: ${new Date().toLocaleTimeString()}`,
          '',
          'Status: Waiting 3s for email to arrive...',
          'Next: Opening email inbox automatically'
        ].join('\n');
        chrome.action.setTitle({ title: detectedInfo });
        return;

      case 'checking_inbox':
        chrome.action.setBadgeText({ text: '📬' });
        chrome.action.setBadgeBackgroundColor({ color: '#ff9500' });
        const checkingInfo = [
          '📬 CHECKING EMAIL INBOX',
          '',
          `Provider: ${badgeState.emailProvider || 'Unknown'}`,
          `Email: ${badgeState.emailAddress || 'Unknown'}`,
          `Looking for: ${badgeState.magicLinkDomain || 'magic link'}`,
          '',
          'Status: Searching recent emails...',
          'Automation: Opening inbox in background'
        ].join('\n');
        chrome.action.setTitle({ title: checkingInfo });
        return;

      case 'found':
        chrome.action.setBadgeText({ text: '✉️' });
        chrome.action.setBadgeBackgroundColor({ color: '#00cc88' }); // Green
        const foundInfo = [
          '✉️ MAGIC LINK FOUND',
          '',
          `Domain: ${badgeState.magicLinkDomain || 'Unknown'}`,
          `Email: ${badgeState.emailAddress || 'Unknown'}`,
          '',
          'Status: Magic link extracted from email',
          'Next: Clicking link automatically...'
        ].join('\n');
        chrome.action.setTitle({ title: foundInfo });
        return;

      case 'clicking':
        chrome.action.setBadgeText({ text: '👆' });
        chrome.action.setBadgeBackgroundColor({ color: '#00cc88' });
        const clickingInfo = [
          '👆 CLICKING MAGIC LINK',
          '',
          `Domain: ${badgeState.magicLinkDomain || 'Unknown'}`,
          `Time: ${new Date().toLocaleTimeString()}`,
          '',
          'Status: Navigating to authentication page...',
          'You will be signed in automatically!'
        ].join('\n');
        chrome.action.setTitle({ title: clickingInfo });
        return;
    }
  }

  // LLM download progress (text-based progress indicator - purple)
  if (badgeState.llmStatus === 'downloading') {
    const progress = badgeState.llmProgress;
    let progressText = '';
    let progressStage = '';

    // Use text-based progress bars (no icon swapping)
    if (progress < 0.25) {
      progressText = '▱▱▱';
      progressStage = '0-25%';
    } else if (progress < 0.50) {
      progressText = '▰▱▱';
      progressStage = '25-50%';
    } else if (progress < 0.75) {
      progressText = '▰▰▱';
      progressStage = '50-75%';
    } else {
      progressText = '▰▰▰';
      progressStage = '75-100%';
    }

    const mb = (badgeState.llmDownloadedBytes / (1024 * 1024)).toFixed(0);
    const totalMb = (badgeState.llmTotalBytes / (1024 * 1024)).toFixed(0);
    const percentComplete = (progress * 100).toFixed(1);
    const remainingMb = Math.max(0, totalMb - mb);

    chrome.action.setBadgeText({ text: progressText });
    chrome.action.setBadgeBackgroundColor({ color: '#8b5cf6' }); // Purple
    const downloadInfo = [
      `${progressText} DOWNLOADING LLM MODEL`,
      '',
      `Model: Gemma 3N-E2B IT`,
      `Progress: ${percentComplete}% complete (${progressStage})`,
      `Downloaded: ${mb} MB / ${totalMb} MB`,
      `Remaining: ${remainingMb} MB`,
      '',
      'Location: OPFS (Origin Private File System)',
      'This is a one-time download',
      '',
      'Progress: ▱▱▱ → ▰▱▱ → ▰▰▱ → ▰▰▰'
    ].join('\n');
    chrome.action.setTitle({ title: downloadInfo });
    return;
  }

  // LLM initialization progress (text-based progress indicator - yellow)
  if (badgeState.llmStatus === 'initializing') {
    const progress = badgeState.llmProgress;
    let progressText = '';
    let progressStage = '';

    // Use text-based progress bars (no icon swapping)
    if (progress < 0.33) {
      progressText = '▱▱▱';
      progressStage = '0-33%';
    } else if (progress < 0.67) {
      // Animate between ▰▱▱ and ▰▰▱ to show activity during long WASM compilation (33-67%)
      progressText = llmInitAnimationFrame % 2 === 0 ? '▰▱▱' : '▰▰▱';
      progressStage = '33-67% (compiling WASM)';

      // Start animation if not already running
      if (!llmInitAnimationInterval) {
        llmInitAnimationInterval = setInterval(() => {
          llmInitAnimationFrame++;
          updateBadge();
        }, 800); // Pulse every 800ms
      }
    } else if (progress < 0.9) {
      progressText = '▰▰▱';
      progressStage = '67-90%';
    } else {
      progressText = '▰▰▰';
      progressStage = '90-100%';
    }

    const percentComplete = (progress * 100).toFixed(1);

    chrome.action.setBadgeText({ text: progressText });
    chrome.action.setBadgeBackgroundColor({ color: '#eab308' }); // Yellow
    const initInfo = [
      `${progressText} INITIALIZING LLM`,
      '',
      `Model: Gemma 3N-E2B IT`,
      `Progress: ${percentComplete}% complete (${progressStage})`,
      '',
      'Status: Compiling WASM and loading model',
      'Runtime: MediaPipe GenAI',
      'Backend: WebGPU',
      '',
      'This may take 10-15 seconds (one-time setup)',
      'Browser remains responsive during compilation'
    ].join('\n');
    chrome.action.setTitle({ title: initInfo });
    return;
  } else {
    // Clear animation when leaving initializing state
    if (llmInitAnimationInterval) {
      clearInterval(llmInitAnimationInterval);
      llmInitAnimationInterval = null;
      llmInitAnimationFrame = 0;
    }
  }

  if (badgeState.llmStatus === 'ready') {
    chrome.action.setBadgeText({ text: '✻' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }); // Green
    const llmInfo = [
      '🤖 LLM READY',
      '',
      'Model: Gemma 3N-E2B IT',
      'Status: Initialized and ready',
      'Runtime: MediaPipe GenAI',
      'Backend: WebGPU',
      '',
      'Ready to generate responses'
    ].join('\n');
    chrome.action.setTitle({ title: llmInfo });
    return;
  }

  if (badgeState.llmStatus === 'generating') {
    chrome.action.setBadgeText({ text: '💭' });
    chrome.action.setBadgeBackgroundColor({ color: '#8b5cf6' });
    const generatingInfo = [
      '💭 LLM GENERATING',
      '',
      'Model: Gemma 3N-E2B IT',
      'Status: Generating response...',
      `Time: ${new Date().toLocaleTimeString()}`,
      '',
      'Using WebGPU acceleration'
    ].join('\n');
    chrome.action.setTitle({ title: generatingInfo });
    return;
  }

  if (badgeState.activeCommand) {
    // Active command
    const commandIcons: Record<NonNullable<CommandType>, string> = {
      navigate: '→',
      click: '⌖',
      type: '⌨',
      wait: '⏱',
      screenshot: '📷',
    };
    const commandNames: Record<NonNullable<CommandType>, string> = {
      navigate: 'Navigate',
      click: 'Click',
      type: 'Type',
      wait: 'Wait',
      screenshot: 'Screenshot',
    };
    chrome.action.setBadgeText({ text: commandIcons[badgeState.activeCommand] });
    chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
    const commandInfo = [
      `${commandIcons[badgeState.activeCommand]} ${commandNames[badgeState.activeCommand].toUpperCase()} COMMAND`,
      '',
      `Command: ${badgeState.activeCommand}`,
      `Started: ${new Date().toLocaleTimeString()}`,
      '',
      'Status: Executing browser automation',
      'Controlled by: MCP server'
    ].join('\n');
    chrome.action.setTitle({ title: commandInfo });
    return;
  }

  // Email identity active badge (lower priority - shows when connected and no activity)
  if (badgeState.emailStatus === 'configured' && badgeState.serverStatus === 'connected') {
    chrome.action.setBadgeText({ text: '👤' });
    chrome.action.setBadgeBackgroundColor({ color: '#00cc88' }); // Green
    const emailInfo = [
      '📧 EMAIL IDENTITY ACTIVE',
      '',
      `Email: ${badgeState.emailAddress || 'Unknown'}`,
      `Provider: ${badgeState.emailProvider || 'Unknown'}`,
      '',
      'Magic link automation is enabled',
      'Forms matching this email will auto-login',
      '',
      'Status: Monitoring for signup/signin forms'
    ].join('\n');
    chrome.action.setTitle({ title: emailInfo });
    return;
  }

  // Non-critical server status (starting, connected)
  switch (badgeState.serverStatus) {
    case 'starting':
      chrome.action.setBadgeText({ text: '⋯' });
      chrome.action.setBadgeBackgroundColor({ color: '#eab308' });
      const startingInfo = [
        '⋯ SERVER STARTING',
        '',
        'Status: Initializing connection',
        'Target: ws://localhost:8085',
        '',
        'Please wait...'
      ].join('\n');
      chrome.action.setTitle({ title: startingInfo });
      break;
    case 'connected':
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
      const connectedInfo = [
        '✓ CONNECTED',
        '',
        'MCP Server: Connected',
        'WebSocket: Active',
        `Connected at: ${new Date().toLocaleTimeString()}`,
        '',
        'Status: Ready for automation commands'
      ].join('\n');
      chrome.action.setTitle({ title: connectedInfo });
      break;
    default:
      // Fallback for any unhandled states
      chrome.action.setBadgeText({ text: '?' });
      chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
      chrome.action.setTitle({ title: 'Agent Browser - Unknown State' });
  }
}

function setBadgeState(updates: Partial<BadgeState>) {
  badgeState = { ...badgeState, ...updates };
  updateBadge();
}

// ============================================================================
// Tab Group Management
// ============================================================================

async function ensureAutomationTabGroup(): Promise<number> {
  if (automationTabGroupId !== null) {
    try {
      // Verify group still exists
      await chrome.tabGroups.get(automationTabGroupId);
      return automationTabGroupId;
    } catch {
      // Group was deleted, create new one
      automationTabGroupId = null;
    }
  }

  // Tab groups are created when we add the first tab to them
  // So we'll just return -1 here and create it when adding the first tab
  return -1;
}

async function addTabToAutomationGroup(tabId: number) {
  try {
    let groupId = await ensureAutomationTabGroup();

    if (groupId === -1) {
      // Create new group with this tab
      groupId = await chrome.tabs.group({ tabIds: tabId });
      await chrome.tabGroups.update(groupId, {
        title: 'Agent Browser',
        color: 'blue',
        collapsed: false,
      });
      automationTabGroupId = groupId;
    } else {
      // Add to existing group
      await chrome.tabs.group({ tabIds: tabId, groupId });
    }
  } catch (error) {
    console.error('[Background] Failed to add tab to automation group:', error);
  }
}

// ============================================================================
// WebSocket Connection
// ============================================================================

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('[Background] Already connected');
    return;
  }

  console.log('[Background] Connecting to WebSocket server...');
  ws = new WebSocket('ws://localhost:8085');

  ws.onopen = () => {
    console.log('[Background] WebSocket connected');
    reconnectAttempts = 0;
    setBadgeState({
      serverStatus: 'connected',
      errorType: null,
      reconnectAttempt: 0,
      errorMessage: undefined,
    });
  };

  ws.onmessage = async (event) => {
    try {
      const message: Message = JSON.parse(event.data);
      console.log('[Background] Received message:', message);

      // Set active command badge
      if (message.method === 'navigate' || message.method === 'click' ||
          message.method === 'type' || message.method === 'wait' ||
          message.method === 'screenshot') {
        setBadgeState({ activeCommand: message.method as CommandType });
      }

      // Handle commands that must run in background
      let response;
      if (message.method === 'screenshot') {
        response = await handleScreenshot(message);
      } else if (message.method === 'passkey_enable') {
        response = await handlePasskeyEnable(message);
      } else if (message.method === 'passkey_status') {
        response = await handlePasskeyStatus(message);
      } else if (message.method === 'passkey_list') {
        response = await handlePasskeyList(message);
      } else if (message.method === 'passkey_clear') {
        response = await handlePasskeyClear(message);
      } else {
        // Route to content script for other commands
        response = await routeToTab(message);
      }

      // Clear active command badge
      setBadgeState({ activeCommand: null });

      // Send response back through WebSocket
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error('[Background] Error handling message:', error);
      setBadgeState({
        activeCommand: null,
        errorType: 'server_error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      // Clear error after 3 seconds
      setTimeout(() => {
        if (badgeState.errorType === 'server_error') {
          setBadgeState({ errorType: null, errorMessage: undefined });
        }
      }, 3000);
    }
  };

  ws.onerror = (error) => {
    console.error('[Background] WebSocket error:', error);
    setBadgeState({
      serverStatus: 'error',
      errorMessage: 'WebSocket error',
    });
  };

  ws.onclose = () => {
    console.log('[Background] WebSocket closed');
    setBadgeState({ serverStatus: 'disconnected' });
    ws = null;

    // Reject all pending requests
    for (const [id, request] of pending.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error('WebSocket disconnected'));
    }
    pending.clear();

    // Attempt reconnection
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[Background] Max reconnect attempts reached');
    setBadgeState({
      serverStatus: 'error',
      errorMessage: 'Max reconnect attempts reached',
    });
    return;
  }

  const delay = Math.min(
    RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts),
    30000
  );

  reconnectAttempts++;
  console.log(`[Background] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

  setBadgeState({
    serverStatus: 'reconnecting',
    reconnectAttempt: reconnectAttempts,
  });

  reconnectTimeout = setTimeout(() => {
    connect();
  }, delay);
}

// ============================================================================
// Tab Routing
// ============================================================================

async function routeToTab(message: Message): Promise<Response> {
  try {
    // Get active tab - try current window first, then any window
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      // No active tab in current window, try any active tab
      tabs = await chrome.tabs.query({ active: true });
    }
    let [tab] = tabs;

    // Check if tab is valid for content script injection
    const isInvalidTab = !tab || !tab.id ||
      tab.url?.startsWith('chrome://') ||
      tab.url?.startsWith('chrome-extension://') ||
      tab.url?.startsWith('edge://') ||
      tab.url?.startsWith('about:');

    if (isInvalidTab) {
      // For navigate commands, create a new tab
      if (message.method === 'navigate') {
        const url = message.params?.url || 'about:blank';
        const newTab = await chrome.tabs.create({ url, active: true });
        if (!newTab.id) {
          throw new Error('Failed to create new tab');
        }
        tab = newTab;

        // Wait for navigation to complete before injecting content script
        await waitForTabReady(tab.id);
      } else {
        throw new Error('No valid tab found - current tab cannot run content scripts (chrome:// or extension pages)');
      }
    }

    // Add tab to automation group if this is a navigation command (but don't fail on error)
    if (message.method === 'navigate') {
      try {
        await addTabToAutomationGroup(tab.id!);
      } catch (err) {
        // Tab groups might not be available in all window types - ignore error
        console.log('[Background] Could not add to tab group (expected in some window types)');
      }
    }

    // For navigate commands, ensure we wait for the page to load
    if (message.method === 'navigate') {
      await waitForTabReady(tab.id!);
    }

    // Check if content script is loaded
    let isLoaded = await checkContentScript(tab.id);

    if (!isLoaded) {
      console.log('[Background] Content script not loaded, injecting...');
      try {
        await injectContentScript(tab.id);
        // Wait a bit longer for script to initialize
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify it loaded
        isLoaded = await checkContentScript(tab.id);
        if (!isLoaded) {
          throw new Error('Content script injected but not responding');
        }
      } catch (injectError) {
        setBadgeState({
          errorType: 'injection_failed',
          errorMessage: 'Failed to inject content script',
        });
        // Clear error after 3 seconds
        setTimeout(() => {
          if (badgeState.errorType === 'injection_failed') {
            setBadgeState({ errorType: null, errorMessage: undefined });
          }
        }, 3000);
        throw injectError;
      }
    }

    // Send message to content script with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 30000);
    });

    const response = await Promise.race([
      chrome.tabs.sendMessage(tab.id, message),
      timeoutPromise,
    ]);

    return {
      id: message.id,
      success: true,
      result: response,
    };
  } catch (error: any) {
    console.error('[Background] Error routing message:', error);

    // Set timeout error badge if it was a timeout
    if (error.message === 'Request timeout') {
      setBadgeState({
        errorType: 'timeout',
        errorMessage: 'Request timed out after 30s',
      });
      // Clear error after 3 seconds
      setTimeout(() => {
        if (badgeState.errorType === 'timeout') {
          setBadgeState({ errorType: null, errorMessage: undefined });
        }
      }, 3000);
    }

    return {
      id: message.id,
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

async function waitForTabReady(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        // Add small delay to ensure DOM is ready
        setTimeout(resolve, 100);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    // Timeout after 30 seconds
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 30000);

    // Check if already complete
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 100);
      }
    });
  });
}

async function checkContentScript(tabId: number): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    return response?.pong === true;
  } catch {
    return false;
  }
}

async function injectContentScript(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });

    // Wait a bit for the script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    console.error('[Background] Failed to inject content script:', error);
    throw error;
  }
}

// ============================================================================
// Screenshot Handler
// ============================================================================

async function handleScreenshot(message: Message): Promise<Response> {
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }

    // Check if tab is a chrome:// or extension page
    const isInvalidTab = tab.url?.startsWith('chrome://') ||
      tab.url?.startsWith('chrome-extension://') ||
      tab.url?.startsWith('edge://') ||
      tab.url?.startsWith('about:');

    if (isInvalidTab) {
      throw new Error('Cannot screenshot system pages (chrome://, chrome-extension://, edge://, or about: pages)');
    }

    // Capture visible tab as PNG data URL
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
    });

    // Extract base64 data from data URL (remove "data:image/png;base64," prefix)
    const base64Data = dataUrl.split(',')[1];

    return {
      id: message.id,
      success: true,
      result: {
        success: true,
        format: 'png',
        data: base64Data,
        encoding: 'base64',
      },
    };
  } catch (error: any) {
    console.error('[Background] Screenshot error:', error);
    return {
      id: message.id,
      success: false,
      error: error.message || 'Screenshot failed',
    };
  }
}

// ============================================================================
// Passkey Automation Handlers
// ============================================================================

async function handlePasskeyEnable(message: Message): Promise<Response> {
  try {
    if (!webAuthnProxy) {
      throw new Error('WebAuthn proxy not initialized');
    }

    const enabled = message.params?.enabled ?? true;
    webAuthnProxy.enableAutomation(enabled);

    return {
      id: message.id,
      success: true,
      result: {
        enabled,
        message: `Passkey automation ${enabled ? 'enabled' : 'disabled'}`
      }
    };
  } catch (error: any) {
    console.error('[Background] Passkey enable error:', error);
    return {
      id: message.id,
      success: false,
      error: error.message || 'Failed to enable passkey automation',
    };
  }
}

async function handlePasskeyStatus(message: Message): Promise<Response> {
  try {
    if (!webAuthnProxy) {
      return {
        id: message.id,
        success: true,
        result: {
          attached: false,
          automationMode: false,
          credentialsCount: 0,
          error: 'WebAuthn proxy not initialized'
        }
      };
    }

    const status = webAuthnProxy.getStatus();

    return {
      id: message.id,
      success: true,
      result: status
    };
  } catch (error: any) {
    console.error('[Background] Passkey status error:', error);
    return {
      id: message.id,
      success: false,
      error: error.message || 'Failed to get passkey status',
    };
  }
}

async function handlePasskeyList(message: Message): Promise<Response> {
  try {
    if (!webAuthnProxy) {
      throw new Error('WebAuthn proxy not initialized');
    }

    const credentials = webAuthnProxy.getStoredCredentials();

    return {
      id: message.id,
      success: true,
      result: {
        credentials,
        count: credentials.length
      }
    };
  } catch (error: any) {
    console.error('[Background] Passkey list error:', error);
    return {
      id: message.id,
      success: false,
      error: error.message || 'Failed to list passkeys',
    };
  }
}

async function handlePasskeyClear(message: Message): Promise<Response> {
  try {
    if (!webAuthnProxy) {
      throw new Error('WebAuthn proxy not initialized');
    }

    webAuthnProxy.clearStoredCredentials();

    return {
      id: message.id,
      success: true,
      result: {
        message: 'All stored passkeys cleared'
      }
    };
  } catch (error: any) {
    console.error('[Background] Passkey clear error:', error);
    return {
      id: message.id,
      success: false,
      error: error.message || 'Failed to clear passkeys',
    };
  }
}

// ============================================================================
// Native Messaging Host - Ensure Server Running
// ============================================================================

async function ensureServerRunning() {
  console.log('[Background] Calling NMH to ensure server is running...');
  setBadgeState({ serverStatus: 'starting' });

  try {
    const response = await chrome.runtime.sendNativeMessage(
      'com.agentbrowser.native',
      { cmd: 'ensure_server' }
    );

    console.log('[Background] NMH response:', response);

    if (response.ok) {
      console.log('[Background] Server is running');
      if (response.logs) {
        console.log('[Background] Server logs:', response.logs);
      }
      // Give server a moment to fully start, then connect WebSocket
      setTimeout(() => connect(), 1000);
    } else {
      console.error('[Background] NMH reported error:', response.error);
      setBadgeState({
        serverStatus: 'error',
        errorMessage: response.error || 'NMH reported error',
      });
      // Fall back to trying to connect anyway (maybe server is running)
      setTimeout(() => connect(), 2000);
    }
  } catch (error: any) {
    console.error('[Background] Failed to call NMH:', error);
    console.log('[Background] NMH may not be installed. Trying to connect to server anyway...');
    setBadgeState({
      serverStatus: 'error',
      errorMessage: 'NMH not responding',
    });
    // Fall back to connecting (maybe server is running manually)
    setTimeout(() => connect(), 2000);
  }
}

// ============================================================================
// Offscreen Document Management
// ============================================================================

async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) {
    console.log('[Background] Offscreen document already exists');
    return;
  }

  console.log('[Background] Creating offscreen document...');
  await chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['WORKERS' as chrome.offscreen.Reason],
    justification: 'Run LLM inference using MediaPipe WebAssembly',
  });

  console.log('[Background] Offscreen document created');
}

async function initializeLlm() {
  console.log('[Background] Initializing LLM...');

  try {
    await setupOffscreenDocument();

    // Send init message to offscreen
    const response = await chrome.runtime.sendMessage({
      type: 'llm_init',
      modelUrl: 'https://storage.googleapis.com/ktex-static/gemma-3n-E2B-it-int4-Web.litertlm'
    });

    if (response?.success) {
      console.log('[Background] LLM initialization started');
    } else {
      console.error('[Background] LLM initialization failed:', response?.error);
    }
  } catch (error) {
    console.error('[Background] Failed to initialize LLM:', error);
  }
}

// Handle messages from offscreen document and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle messages from offscreen document
  if (sender.url === chrome.runtime.getURL('offscreen.html')) {
    console.log('[Background] Message from offscreen:', message.type);

    switch (message.type) {
      case 'llm_progress':
        console.log('[Background] LLM progress:', message.stage, message.progress, message.downloadedBytes, message.totalBytes);
        setBadgeState({
          llmStatus: message.stage === 'initializing' ? 'initializing' : 'downloading',
          llmProgress: message.progress || 0,
          llmDownloadedBytes: message.downloadedBytes || 0,
          llmTotalBytes: message.totalBytes || 0,
        });
        updateBadge(); // Force badge update
        // Forward to popup
        chrome.runtime.sendMessage(message).catch(() => {});
        break;

      case 'llm_ready':
        offscreenReady = true;
        setBadgeState({
          llmStatus: 'ready',
          llmProgress: 1,
        });
        console.log('[Background] LLM is ready');
        // Forward to popup
        chrome.runtime.sendMessage(message).catch(() => {});
        break;

      case 'llm_chunk':
        // Forward to MCP server via WebSocket if needed
        console.log('[Background] LLM chunk:', message.text?.substring(0, 50));
        break;

      case 'llm_response_chunk':
        // Forward to popup (broadcast to all extension contexts)
        chrome.runtime.sendMessage(message).catch(() => {});
        break;

      case 'llm_response_complete':
        setBadgeState({ llmStatus: 'ready' });
        // Forward to popup
        chrome.runtime.sendMessage(message).catch(() => {});
        break;

      case 'llm_complete':
        setBadgeState({ llmStatus: 'ready' });
        console.log('[Background] LLM generation complete');
        break;

      case 'llm_error':
        setBadgeState({
          llmStatus: 'error',
          errorType: 'server_error',
          errorMessage: message.error || 'LLM error',
        });
        console.error('[Background] LLM error:', message.error);
        // Forward to popup
        chrome.runtime.sendMessage(message).catch(() => {});
        break;

      case 'worker_test_result':
        console.log('🔬 [Background] Worker Test Result:', message.available ? '✅ AVAILABLE' : '❌ NOT AVAILABLE');
        console.log('🔬 [Background] Details:', message.details);
        break;
    }
    return;
  }

  // Handle test LLM request from popup
  if (message.type === 'test_llm') {
    console.log('[Background] Test LLM request:', message.prompt);

    // Check if LLM is ready, if not initialize it first
    if (badgeState.llmStatus === 'idle' || badgeState.llmStatus === 'error') {
      console.log('[Background] LLM not initialized - starting initialization');
      setBadgeState({ llmStatus: 'downloading' });

      // Initialize LLM first
      initializeLlm().then(() => {
        console.log('[Background] LLM initialized, now sending prompt');
        // Wait a bit for ready message
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'generate', prompt: message.prompt }).catch(err => {
            console.error('[Background] Failed to send to offscreen:', err);
          });
        }, 1000);
      }).catch(err => {
        console.error('[Background] LLM initialization failed:', err);
      });
    } else if (badgeState.llmStatus === 'ready') {
      // LLM already ready, send immediately
      setBadgeState({ llmStatus: 'generating' });
      chrome.runtime.sendMessage({ type: 'generate', prompt: message.prompt }).catch(err => {
        console.error('[Background] Failed to send to offscreen:', err);
      });
    } else {
      // LLM is still loading/downloading
      console.log('[Background] LLM still loading, queuing prompt...');
      // Queue the prompt to send after ready
      const readyListener = (msg: any) => {
        if (msg.type === 'llm_ready') {
          chrome.runtime.onMessage.removeListener(readyListener);
          chrome.runtime.sendMessage({ type: 'generate', prompt: message.prompt }).catch(err => {
            console.error('[Background] Failed to send to offscreen:', err);
          });
        }
      };
      chrome.runtime.onMessage.addListener(readyListener);
    }
    return;
  }

  // Handle check LLM status from popup - don't auto-load to avoid freeze
  if (message.type === 'check_llm_status') {
    // Don't auto-initialize - let user trigger it manually to avoid browser freeze
    sendResponse({
      ready: offscreenReady,
      status: badgeState.llmStatus,
      progress: badgeState.llmProgress
    });
    return true; // Keep channel open for async response
  }

  // Handle messages from content scripts
  if (message.type === 'magic_link_detected') {
    handleMagicLinkDetection(message).catch(error => {
      console.error('[Background] Error handling magic link:', error);
      setBadgeState({
        magicLinkStatus: 'idle',
        errorType: 'server_error',
        errorMessage: 'Magic link automation failed',
      });
    });
    return;
  }
});

// ============================================================================
// Magic Link Automation
// ============================================================================

async function handleMagicLinkDetection(message: any) {
  console.log('[Background] Magic link detected from content script:', message);

  const { email, formType, url } = message;

  // Extract domain from URL
  const domain = new URL(url).hostname;

  // Update badge: detected
  setBadgeState({
    magicLinkStatus: 'detected',
    magicLinkDomain: domain,
  });

  // Wait a bit for email to arrive
  console.log('[Background] Waiting 3 seconds for email to arrive...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Update badge: checking inbox
  setBadgeState({ magicLinkStatus: 'checking_inbox' });

  // Get inbox automation
  const inboxAutomation = getEmailInboxAutomation();

  // Automate login
  const success = await inboxAutomation.automateLogin(domain);

  if (success) {
    console.log('[Background] Magic link automation successful!');
    setBadgeState({
      magicLinkStatus: 'clicking',
    });

    // Reset after a delay
    setTimeout(() => {
      setBadgeState({ magicLinkStatus: 'idle' });
    }, 5000);
  } else {
    console.log('[Background] Magic link not found in inbox');
    setBadgeState({
      magicLinkStatus: 'idle',
      errorType: 'server_error',
      errorMessage: 'Magic link not found in email inbox',
    });

    // Clear error after 3 seconds
    setTimeout(() => {
      if (badgeState.errorType === 'server_error') {
        setBadgeState({ errorType: null, errorMessage: undefined });
      }
    }, 3000);
  }
}

// ============================================================================
// Email Provider Status Check
// ============================================================================

async function checkEmailProviderStatus() {
  try {
    const stored = await chrome.storage.local.get('emailProviderConfig');

    if (stored.emailProviderConfig?.setupComplete) {
      console.log('[Background] Email provider configured:', stored.emailProviderConfig.email);
      setBadgeState({
        emailStatus: 'configured',
        emailAddress: stored.emailProviderConfig.email,
        emailProvider: stored.emailProviderConfig.provider
      });
    } else {
      console.log('[Background] Email provider not configured');
      setBadgeState({
        emailStatus: 'not_configured'
      });
    }
  } catch (error) {
    console.error('[Background] Error checking email provider status:', error);
    setBadgeState({
      emailStatus: 'not_configured'
    });
  }
}

// ============================================================================
// Initialization
// ============================================================================

// Check email provider status first
checkEmailProviderStatus();

// Set initial badge state
updateBadge();

// Initialize WebAuthn proxy
async function initializeWebAuthnProxy() {
  try {
    webAuthnProxy = new WebAuthnProxy();
    await webAuthnProxy.initialize();
    console.log('[Background] WebAuthn proxy initialized');
  } catch (error) {
    console.error('[Background] Failed to initialize WebAuthn proxy:', error);
    webAuthnProxy = null;
  }
}

initializeWebAuthnProxy();

// Create offscreen document for Worker test (but don't init LLM to avoid freeze)
setupOffscreenDocument().catch(err => {
  console.error('[Background] Failed to create offscreen document:', err);
});

// Don't initialize LLM at startup - lazy load on first use to prevent browser freeze
// initializeLlm();

// Ensure server is running, then connect
ensureServerRunning();

// Handle extension icon click
chrome.action.onClicked.addListener(async () => {
  console.log('[Background] Extension icon clicked');

  // If onboarding needed, open welcome page
  if (badgeState.emailStatus === 'not_configured') {
    console.log('[Background] Opening welcome page for onboarding');
    await chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html'),
      active: true
    });
    return;
  }

  // Otherwise, ensure server is running (for debugging)
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log('[Background] Reconnecting to server');
    ensureServerRunning();
  }
});

// Handle tab updates (re-inject if needed)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    // Proactively inject content script on page load
    const isLoaded = await checkContentScript(tabId);
    if (!isLoaded) {
      console.log('[Background] Injecting content script into tab', tabId);
      try {
        await injectContentScript(tabId);
      } catch (error) {
        console.error('[Background] Failed to inject content script:', error);
      }
    }
  }
});

// ============================================================================
// First Install - Welcome Page
// ============================================================================

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[Background] First install detected, opening welcome page');

    // Check if already configured
    const stored = await chrome.storage.local.get('emailProviderConfig');
    if (stored.emailProviderConfig?.setupComplete) {
      console.log('[Background] Email provider already configured');
      return;
    }

    // Open welcome page
    await chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html'),
      active: true
    });
  } else if (details.reason === 'update') {
    console.log('[Background] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

console.log('[Background] Initialized');
