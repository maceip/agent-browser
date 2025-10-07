/**
 * Content script - Command execution in web pages
 *
 * - Listen for commands from background
 * - Execute: navigate, click, type, wait
 * - Return result
 */

import { clickCommand } from '../lib/automation/click';
import { typeCommand } from '../lib/automation/type';
import { waitCommand } from '../lib/automation/wait';
import { getModeConfig } from '../lib/automation/mode-config';
import type { Command, CommandAction } from '../lib/automation/types';

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

// ============================================================================
// Initialization
// ============================================================================

console.log('[Content] Script loaded:', window.location.href);
