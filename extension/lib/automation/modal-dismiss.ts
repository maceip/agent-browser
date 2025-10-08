/**
 * Modal Dismissal Handler
 *
 * Dismisses modals using various strategies:
 * - Click dismiss button
 * - ESC key
 * - Click backdrop
 * - Remove from DOM (last resort)
 */

import type { ModeConfig } from './types';
import type { ModalInfo } from './modal-detector';
import { detectModal } from './modal-detector';
import { getModalInteractionDelay, sleep as delayUtilsSleep } from './delay-utils';

// ============================================================================
// Types
// ============================================================================

export type DismissStrategy =
  | 'auto'       // Try all strategies in order (prefers accept for GDPR/cookie)
  | 'accept'     // Click accept/allow button (for GDPR/cookie modals)
  | 'button'     // Click dismiss button
  | 'escape'     // Press ESC key
  | 'backdrop'   // Click backdrop
  | 'remove';    // Remove from DOM

export interface DismissOptions {
  strategy?: DismissStrategy;
  timeout?: number;
  waitAfter?: number; // Wait after dismissal to verify
}

export interface DismissResult {
  success: boolean;
  strategy?: DismissStrategy;
  error?: string;
  modalInfo?: ModalInfo;
  duration: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_WAIT_AFTER = 500;

// ============================================================================
// Main Dismissal Function
// ============================================================================

/**
 * Dismiss a modal using the specified strategy
 */
export async function dismissModal(
  config: ModeConfig,
  options: DismissOptions = {}
): Promise<DismissResult> {
  const startTime = Date.now();
  const strategy = options.strategy || 'auto';
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const waitAfter = options.waitAfter || DEFAULT_WAIT_AFTER;

  try {
    // Detect modal
    const modalInfo = detectModal();

    if (!modalInfo) {
      return {
        success: false,
        error: 'No modal detected',
        duration: Date.now() - startTime,
      };
    }

    // Execute strategy
    let result: DismissResult;

    if (strategy === 'auto') {
      result = await tryAllStrategies(modalInfo, config, timeout);
    } else {
      result = await executeStrategy(strategy, modalInfo, config);
    }

    // Wait and verify dismissal
    if (result.success) {
      await sleep(waitAfter);

      // Check if modal is still present
      const stillPresent = detectModal();
      if (stillPresent && stillPresent.element === modalInfo.element) {
        return {
          success: false,
          error: 'Modal still present after dismissal attempt',
          strategy: result.strategy,
          modalInfo,
          duration: Date.now() - startTime,
        };
      }
    }

    return {
      ...result,
      modalInfo,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Strategy Execution
// ============================================================================

/**
 * Try all dismissal strategies in order until one succeeds
 * For GDPR/cookie modals, prioritize "Accept All" button
 */
async function tryAllStrategies(
  modalInfo: ModalInfo,
  config: ModeConfig,
  timeout: number
): Promise<DismissResult> {
  let strategies: DismissStrategy[];

  // For GDPR/cookie modals, try accept button first
  if ((modalInfo.type === 'cookie-consent' || modalInfo.type === 'gdpr') &&
      modalInfo.acceptButton) {
    strategies = ['accept', 'button', 'escape', 'backdrop', 'remove'];
  } else {
    strategies = ['button', 'escape', 'backdrop', 'remove'];
  }

  const startTime = Date.now();

  for (const strategy of strategies) {
    // Check timeout
    if (Date.now() - startTime > timeout) {
      return {
        success: false,
        error: 'Timeout while trying dismissal strategies',
        duration: Date.now() - startTime,
      };
    }

    try {
      const result = await executeStrategy(strategy, modalInfo, config);
      if (result.success) {
        return result;
      }
    } catch (error) {
      // Continue to next strategy
      console.error(`[Modal Dismiss] Strategy ${strategy} failed:`, error);
    }
  }

  return {
    success: false,
    error: 'All dismissal strategies failed',
    duration: Date.now() - startTime,
  };
}

/**
 * Execute a specific dismissal strategy
 */
async function executeStrategy(
  strategy: DismissStrategy,
  modalInfo: ModalInfo,
  config: ModeConfig
): Promise<DismissResult> {
  const startTime = Date.now();

  switch (strategy) {
    case 'accept':
      return await dismissViaAcceptButton(modalInfo, config);

    case 'button':
      return await dismissViaButton(modalInfo, config);

    case 'escape':
      return await dismissViaEscape(modalInfo, config);

    case 'backdrop':
      return await dismissViaBackdrop(modalInfo, config);

    case 'remove':
      return await dismissViaRemove(modalInfo);

    default:
      return {
        success: false,
        error: `Unknown strategy: ${strategy}`,
        duration: Date.now() - startTime,
      };
  }
}

// ============================================================================
// Individual Strategies
// ============================================================================

/**
 * Strategy: Click the "Accept All" button (for GDPR/cookie modals)
 */
async function dismissViaAcceptButton(
  modalInfo: ModalInfo,
  config: ModeConfig
): Promise<DismissResult> {
  const startTime = Date.now();

  if (!modalInfo.acceptButton) {
    return {
      success: false,
      error: 'No accept button found',
      strategy: 'accept',
      duration: Date.now() - startTime,
    };
  }

  try {
    // Scroll button into view if needed
    modalInfo.acceptButton.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    await delayUtilsSleep(200);

    // Use modal-specific delay
    const delay = getModalInteractionDelay(config);
    await delayUtilsSleep(delay);

    // Click the accept button
    modalInfo.acceptButton.click();

    return {
      success: true,
      strategy: 'accept',
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to click accept button',
      strategy: 'accept',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Strategy: Click the dismiss button
 */
async function dismissViaButton(
  modalInfo: ModalInfo,
  config: ModeConfig
): Promise<DismissResult> {
  const startTime = Date.now();

  if (!modalInfo.dismissButton) {
    return {
      success: false,
      error: 'No dismiss button found',
      strategy: 'button',
      duration: Date.now() - startTime,
    };
  }

  try {
    // Scroll button into view if needed
    modalInfo.dismissButton.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    await delayUtilsSleep(200);

    // Use modal-specific delay
    const delay = getModalInteractionDelay(config);
    await delayUtilsSleep(delay);

    // Click the button
    modalInfo.dismissButton.click();

    return {
      success: true,
      strategy: 'button',
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to click dismiss button',
      strategy: 'button',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Strategy: Press ESC key
 */
async function dismissViaEscape(
  modalInfo: ModalInfo,
  config: ModeConfig
): Promise<DismissResult> {
  const startTime = Date.now();

  try {
    // Focus the modal element if it's not focused
    if (document.activeElement !== modalInfo.element) {
      modalInfo.element.focus();
      await sleep(100);
    }

    // Dispatch ESC key event
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
    });

    modalInfo.element.dispatchEvent(escapeEvent);

    // Also try on document
    document.dispatchEvent(escapeEvent);

    return {
      success: true,
      strategy: 'escape',
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to dispatch ESC key',
      strategy: 'escape',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Strategy: Click the backdrop
 */
async function dismissViaBackdrop(
  modalInfo: ModalInfo,
  config: ModeConfig
): Promise<DismissResult> {
  const startTime = Date.now();

  if (!modalInfo.backdrop) {
    return {
      success: false,
      error: 'No backdrop found',
      strategy: 'backdrop',
      duration: Date.now() - startTime,
    };
  }

  try {
    // Use modal-specific delay
    const delay = getModalInteractionDelay(config);
    await delayUtilsSleep(delay);

    // Click the backdrop
    modalInfo.backdrop.click();

    return {
      success: true,
      strategy: 'backdrop',
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to click backdrop',
      strategy: 'backdrop',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Strategy: Remove modal from DOM (last resort)
 */
async function dismissViaRemove(
  modalInfo: ModalInfo
): Promise<DismissResult> {
  const startTime = Date.now();

  try {
    // Remove modal element
    modalInfo.element.remove();

    // Remove backdrop if present
    if (modalInfo.backdrop) {
      modalInfo.backdrop.remove();
    }

    // Remove any body scroll locks (common pattern)
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';

    return {
      success: true,
      strategy: 'remove',
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to remove modal from DOM',
      strategy: 'remove',
      duration: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Advanced Dismissal Helpers
// ============================================================================

/**
 * Dismiss all detected modals
 */
export async function dismissAllModals(
  config: ModeConfig,
  options: DismissOptions = {}
): Promise<DismissResult[]> {
  const results: DismissResult[] = [];
  const maxAttempts = 5; // Prevent infinite loops

  for (let i = 0; i < maxAttempts; i++) {
    const result = await dismissModal(config, options);

    if (!result.success) {
      // No more modals or failed to dismiss
      break;
    }

    results.push(result);

    // Wait a bit before checking for next modal
    await sleep(options.waitAfter || DEFAULT_WAIT_AFTER);
  }

  return results;
}

/**
 * Check if any modals are present
 */
export function hasModal(): boolean {
  return detectModal() !== null;
}
