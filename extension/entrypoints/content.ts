/**
 * Content script - Command execution in web pages
 *
 * - Listen for commands from background
 * - Execute: navigate, click, type, wait
 * - Return result
 * - Monitor for magic link authentication flows
 */

import { clickCommand } from '../lib/automation/click';
import { typeCommand } from '../lib/automation/type';
import { waitCommand } from '../lib/automation/wait';
import { getModeConfig } from '../lib/automation/mode-config';
import { detectModal, detectAllModals } from '../lib/automation/modal-detector';
import { dismissModal } from '../lib/automation/modal-dismiss';
import type { Command, CommandAction } from '../lib/automation/types';
import { getMagicLinkDetector } from '../lib/automation/magic-link-detector';
import type { MagicLinkDetection } from '../lib/automation/magic-link-detector';
import { initAutoModalHandler } from '../lib/automation/auto-modal-handler';

// ============================================================================
// Message Handler
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle ping for content script detection
  if (message.type === 'ping') {
    sendResponse({ pong: true });
    return true;
  }

  // Handle commands
  if (message.id && message.method) {
    handleCommand(message as Command)
      .then(result => {
        sendResponse({
          id: message.id,
          success: true,
          result,
        });
      })
      .catch(error => {
        console.error('[Content] Command error:', error);
        sendResponse({
          id: message.id,
          success: false,
          error: error.message || 'Unknown error',
        });
      });

    return true; // Will respond asynchronously
  }

  return false;
});

// ============================================================================
// Command Router
// ============================================================================

async function handleCommand(command: Command): Promise<any> {
  console.log('[Content] Executing command:', command);

  const config = getModeConfig(command.mode);
  const action = command.method as CommandAction;

  switch (action) {
    case 'navigate':
      return await handleNavigate(command);

    case 'click':
      return await clickCommand(command, config);

    case 'type':
      return await typeCommand(command, config);

    case 'wait':
      return await waitCommand(command, config);

    case 'screenshot':
      return await handleScreenshot(command);

    case 'get_element':
      return await handleGetElement(command);

    case 'detect_modal':
      return await handleDetectModal(command);

    case 'dismiss_modal':
      return await handleDismissModal(command, config);

    default:
      throw new Error(`Unknown command: ${action}`);
  }
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleNavigate(command: Command): Promise<any> {
  const { url } = command.params;

  if (!url) {
    throw new Error('URL is required for navigate command');
  }

  window.location.href = url;

  return {
    success: true,
    url,
  };
}

async function handleScreenshot(command: Command): Promise<any> {
  // Screenshot requires background script to use chrome.tabs.captureVisibleTab
  // For now, we'll return a placeholder
  return {
    success: true,
    message: 'Screenshot not yet implemented in MVP',
  };
}

async function handleGetElement(command: Command): Promise<any> {
  const { selector, xpath } = command.params;

  let element: Element | null = null;

  if (selector) {
    element = document.querySelector(selector);
  } else if (xpath) {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    element = result.singleNodeValue as Element | null;
  }

  if (!element) {
    return {
      found: false,
      selector: selector || xpath,
    };
  }

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return {
    found: true,
    selector: selector || xpath,
    bounds: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    visible:
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0',
    tagName: element.tagName.toLowerCase(),
    id: element.id,
    className: element.className,
  };
}

async function handleDetectModal(command: Command): Promise<any> {
  const { minZIndex, includeHidden, maxResults } = command.params;

  const options = {
    minZIndex,
    includeHidden,
    maxResults,
  };

  if (maxResults && maxResults > 1) {
    // Detect all modals
    const modals = detectAllModals(options);
    return {
      success: true,
      modals: modals.map(m => ({
        type: m.type,
        confidence: m.confidence,
        hasDismissButton: m.dismissButton !== null,
        hasBackdrop: m.backdrop !== null,
        zIndex: m.zIndex,
        metadata: m.metadata,
      })),
      count: modals.length,
    };
  } else {
    // Detect primary modal
    const modal = detectModal(options);

    if (!modal) {
      return {
        success: true,
        detected: false,
      };
    }

    return {
      success: true,
      detected: true,
      modal: {
        type: modal.type,
        confidence: modal.confidence,
        hasDismissButton: modal.dismissButton !== null,
        hasBackdrop: modal.backdrop !== null,
        zIndex: modal.zIndex,
        metadata: modal.metadata,
      },
    };
  }
}

async function handleDismissModal(command: Command, config: ModeConfig): Promise<any> {
  const { strategy, timeout, waitAfter } = command.params;

  const result = await dismissModal(config, {
    strategy,
    timeout,
    waitAfter,
  });

  return {
    success: result.success,
    error: result.error,
    strategy: result.strategy,
    duration: result.duration,
    modalType: result.modalInfo?.type,
  };
}

// ============================================================================
// Magic Link Detection
// ============================================================================

const magicLinkDetector = getMagicLinkDetector();

// Set up detection callback
magicLinkDetector.onDetection(async (detection: MagicLinkDetection) => {
  console.log('[Content] Magic link detected, notifying background:', detection);

  // Notify background script
  try {
    await chrome.runtime.sendMessage({
      type: 'magic_link_detected',
      email: detection.email,
      formType: detection.formType,
      url: window.location.href,
    });
  } catch (error) {
    console.error('[Content] Error notifying background:', error);
  }
});

// Start monitoring forms
magicLinkDetector.startMonitoring();

// ============================================================================
// Auto Modal Handler
// ============================================================================

// Initialize automatic modal dismissal (GDPR/cookie banners)
try {
  console.log('[Content] Initializing auto-modal handler...');
  const modeConfig = getModeConfig('auto');
  const autoModalHandler = initAutoModalHandler(modeConfig, {
    enabled: true,
    checkInterval: 1000,
    maxChecksPerPage: 10,
    onlyFirstVisit: true, // Only dismiss GDPR/cookie modals on first visit
    modalTypes: ['cookie-consent', 'gdpr'],
    delayBeforeDismiss: 500,
    delayAfterDismiss: 1000,
    onModalDetected: (modalType) => {
      console.log(`[Content] 🎯 Auto-modal detected: ${modalType}`);
    },
    onModalDismissed: (result) => {
      if (result.success) {
        console.log(`[Content] ✅ Auto-modal dismissed using ${result.strategy} strategy`);
      } else {
        console.warn(`[Content] ❌ Auto-modal dismiss failed: ${result.error}`);
      }
    },
    onError: (error) => {
      console.error('[Content] Auto-modal error:', error);
    },
  });
  console.log('[Content] ✓ Auto-modal handler initialized successfully');
} catch (error) {
  console.error('[Content] Failed to initialize auto-modal handler:', error);
}

// ============================================================================
// Initialization
// ============================================================================

console.log('[Content] Script loaded:', window.location.href);
console.log('[Content] Magic link detection active');
console.log('[Content] Auto-modal handler enabled');
