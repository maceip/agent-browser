/**
 * Automatic Modal Handler with Safeguards
 *
 * Automatically detects and dismisses modals with:
 * - Smart GDPR/cookie detection (only on first visit)
 * - Rate limiting to prevent excessive actions
 * - Configurable safeguards
 * - Preference for "Accept All" on cookie modals
 */

import type { ModeConfig } from './types';
import { detectModal } from './modal-detector';
import { dismissModal, type DismissResult } from './modal-dismiss';
import { sleep } from './delay-utils';

// ============================================================================
// Types
// ============================================================================

export interface AutoModalConfig {
  enabled: boolean;

  // Detection settings
  checkInterval: number; // ms between checks (default: 1000)
  maxChecksPerPage: number; // Prevent runaway checks (default: 10)

  // Safeguards
  onlyFirstVisit: boolean; // Only handle GDPR/cookie on first visit (default: true)
  modalTypes: string[]; // Which modal types to auto-dismiss (default: ['cookie-consent', 'gdpr'])

  // Timing
  delayBeforeDismiss: number; // Wait before dismissing (default: 500ms)
  delayAfterDismiss: number; // Wait after dismissing (default: 1000ms)

  // Callbacks
  onModalDetected?: (modalType: string) => void;
  onModalDismissed?: (result: DismissResult) => void;
  onError?: (error: Error) => void;
}

interface HandlerState {
  checkCount: number;
  lastCheckTime: number;
  dismissedModals: Set<HTMLElement>;
  currentUrl: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: AutoModalConfig = {
  enabled: true,
  checkInterval: 1000,
  maxChecksPerPage: 10,
  onlyFirstVisit: true, // Smart: only dismiss GDPR/cookie on first visit per origin
  modalTypes: ['cookie-consent', 'gdpr'],
  delayBeforeDismiss: 500,
  delayAfterDismiss: 1000,
};

// ============================================================================
// Auto Modal Handler Class
// ============================================================================

export class AutoModalHandler {
  private config: AutoModalConfig;
  private modeConfig: ModeConfig;
  private state: HandlerState;
  private intervalId: number | null = null;
  private observer: MutationObserver | null = null;

  constructor(modeConfig: ModeConfig, config: Partial<AutoModalConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modeConfig = modeConfig;
    this.state = {
      checkCount: 0,
      lastCheckTime: 0,
      dismissedModals: new Set(),
      currentUrl: window.location.href,
    };
  }

  /**
   * Start automatic modal handling
   */
  public start(): void {
    if (!this.config.enabled) {
      console.log('[Auto Modal] Handler is disabled');
      return;
    }

    console.log('[Auto Modal] Starting automatic modal handler');

    // Reset state on URL change
    this.setupUrlChangeDetection();

    // Set up periodic checks
    this.startPeriodicChecks();

    // Set up DOM mutation observer for immediate detection
    this.startMutationObserver();
  }

  /**
   * Stop automatic modal handling
   */
  public stop(): void {
    console.log('[Auto Modal] Stopping automatic modal handler');

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Manually trigger a modal check
   */
  public async checkNow(): Promise<void> {
    await this.checkAndDismissModals();
  }

  /**
   * Reset state (useful for testing or manual control)
   */
  public reset(): void {
    this.state = {
      checkCount: 0,
      lastCheckTime: 0,
      dismissedModals: new Set(),
      currentUrl: window.location.href,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Set up URL change detection to reset state
   */
  private setupUrlChangeDetection(): void {
    // Check URL periodically
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.state.currentUrl) {
        console.log('[Auto Modal] URL changed, resetting state');
        this.reset();
      }
    }, 1000);
  }

  /**
   * Start periodic modal checks
   */
  private startPeriodicChecks(): void {
    this.intervalId = window.setInterval(() => {
      this.checkAndDismissModals();
    }, this.config.checkInterval);
  }

  /**
   * Start mutation observer for immediate modal detection
   */
  private startMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      // Check if any mutations added elements with high z-index or modal-like attributes
      const hasModalMutation = mutations.some(mutation => {
        return Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;

            // Check for modal indicators
            const hasModalRole = element.getAttribute('role') === 'dialog' ||
                                element.getAttribute('aria-modal') === 'true';
            const hasModalClass = /modal|dialog|popup|overlay/i.test(element.className);

            return hasModalRole || hasModalClass;
          }
          return false;
        });
      });

      if (hasModalMutation) {
        // Debounce: wait a bit for modal to fully render
        setTimeout(() => {
          this.checkAndDismissModals();
        }, 300);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Check for modals and dismiss if appropriate
   */
  private async checkAndDismissModals(): Promise<void> {
    // Rate limiting: max checks per page
    if (this.state.checkCount >= this.config.maxChecksPerPage) {
      return;
    }

    // Rate limiting: min time between checks
    const now = Date.now();
    if (now - this.state.lastCheckTime < this.config.checkInterval / 2) {
      return;
    }

    this.state.lastCheckTime = now;
    this.state.checkCount++;

    try {
      const modal = detectModal();

      if (!modal) {
        return;
      }

      // Skip if already dismissed
      if (this.state.dismissedModals.has(modal.element)) {
        return;
      }

      // Check if we should handle this modal type
      if (!this.config.modalTypes.includes(modal.type)) {
        console.log(`[Auto Modal] Ignoring modal type: ${modal.type}`);
        return;
      }

      // GDPR/Cookie safeguard: only on first visit
      if (this.config.onlyFirstVisit &&
          (modal.type === 'cookie-consent' || modal.type === 'gdpr')) {

        if (!modal.metadata.isFirstVisit) {
          console.log('[Auto Modal] Skipping GDPR/cookie modal (not first visit)');
          return;
        }
      }

      // Notify detection
      if (this.config.onModalDetected) {
        this.config.onModalDetected(modal.type);
      }

      console.log(`[Auto Modal] Detected ${modal.type} modal, will dismiss in ${this.config.delayBeforeDismiss}ms`);

      // Wait before dismissing
      await sleep(this.config.delayBeforeDismiss);

      // Dismiss the modal
      const result = await dismissModal(this.modeConfig, {
        strategy: 'auto', // Will prefer 'accept' for GDPR/cookie
        waitAfter: this.config.delayAfterDismiss,
      });

      // Track as dismissed
      this.state.dismissedModals.add(modal.element);

      // Notify dismissal
      if (this.config.onModalDismissed) {
        this.config.onModalDismissed(result);
      }

      if (result.success) {
        console.log(`[Auto Modal] Successfully dismissed ${modal.type} modal using ${result.strategy} strategy`);
      } else {
        console.warn(`[Auto Modal] Failed to dismiss modal: ${result.error}`);
      }

    } catch (error) {
      console.error('[Auto Modal] Error in check and dismiss:', error);
      if (this.config.onError && error instanceof Error) {
        this.config.onError(error);
      }
    }
  }
}

// ============================================================================
// Singleton Instance (for easy content script usage)
// ============================================================================

let globalHandler: AutoModalHandler | null = null;

/**
 * Initialize global auto modal handler
 */
export function initAutoModalHandler(
  modeConfig: ModeConfig,
  config?: Partial<AutoModalConfig>
): AutoModalHandler {
  if (globalHandler) {
    globalHandler.stop();
  }

  globalHandler = new AutoModalHandler(modeConfig, config);
  globalHandler.start();

  return globalHandler;
}

/**
 * Get global handler instance
 */
export function getAutoModalHandler(): AutoModalHandler | null {
  return globalHandler;
}

/**
 * Stop global handler
 */
export function stopAutoModalHandler(): void {
  if (globalHandler) {
    globalHandler.stop();
    globalHandler = null;
  }
}
