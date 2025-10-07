/**
 * Background script - WebSocket client and message routing
 *
 * - Connect WebSocket to localhost:8085
 * - Route messages to correct tab
 * - Auto-inject content script if dead
 * - Reconnect if disconnected
 */

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

interface BadgeState {
  serverStatus: ServerStatus;
  activeCommand: CommandType;
  errorType: ErrorType;
  reconnectAttempt: number;
  errorMessage?: string;
}

let badgeState: BadgeState = {
  serverStatus: 'starting',
  activeCommand: null,
  errorType: null,
  reconnectAttempt: 0,
};

// Tab groups
let automationTabGroupId: number | null = null;

// ============================================================================
// Badge Management
// ============================================================================

function updateBadge() {
  // Priority: Error > Active Command > Reconnecting > Server Status

  if (badgeState.errorType) {
    // Error state
    chrome.action.setBadgeText({ text: '⚠' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    const errorMsg = badgeState.errorMessage || 'Unknown error';
    chrome.action.setTitle({ title: `Error: ${errorMsg}` });
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
    chrome.action.setBadgeText({ text: commandIcons[badgeState.activeCommand] });
    chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
    chrome.action.setTitle({ title: `Active: ${badgeState.activeCommand}` });
    return;
  }

  if (badgeState.serverStatus === 'reconnecting') {
    // Reconnecting
    chrome.action.setBadgeText({ text: `↻${badgeState.reconnectAttempt}` });
    chrome.action.setBadgeBackgroundColor({ color: '#eab308' });
    chrome.action.setTitle({
      title: `Reconnecting (attempt ${badgeState.reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})`
    });
    return;
  }

  // Server status
  switch (badgeState.serverStatus) {
    case 'starting':
      chrome.action.setBadgeText({ text: '⋯' });
      chrome.action.setBadgeBackgroundColor({ color: '#eab308' });
      chrome.action.setTitle({ title: 'Server starting...' });
      break;
    case 'connected':
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
      chrome.action.setTitle({ title: 'Connected • Ready' });
      break;
    case 'disconnected':
      chrome.action.setBadgeText({ text: '✗' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      chrome.action.setTitle({ title: 'Disconnected' });
      break;
    case 'error':
      chrome.action.setBadgeText({ text: '✗' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      chrome.action.setTitle({ title: badgeState.errorMessage || 'Server error' });
      break;
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

      // Handle screenshot in background (chrome.tabs.captureVisibleTab requires it)
      let response;
      if (message.method === 'screenshot') {
        response = await handleScreenshot(message);
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
    // Get active tab (for now, we'll route to active tab)
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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
        // Wait for tab to load
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        throw new Error('No valid tab found - current tab cannot run content scripts (chrome:// or extension pages)');
      }
    }

    // Add tab to automation group if this is a navigation command
    if (message.method === 'navigate') {
      await addTabToAutomationGroup(tab.id!);
    }

    // Check if content script is loaded
    const isLoaded = await checkContentScript(tab.id);

    if (!isLoaded) {
      console.log('[Background] Content script not loaded, injecting...');
      try {
        await injectContentScript(tab.id);
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
// Initialization
// ============================================================================

// Set initial badge state
updateBadge();

// Ensure server is running, then connect
ensureServerRunning();

// Handle extension icon click (optional - for debugging)
chrome.action.onClicked.addListener(() => {
  console.log('[Background] Extension icon clicked');
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    // Call NMH to ensure server is running before connecting
    ensureServerRunning();
  }
});

// Handle tab updates (re-inject if needed)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
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

console.log('[Background] Initialized');
