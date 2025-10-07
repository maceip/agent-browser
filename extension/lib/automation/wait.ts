/**
 * Wait command implementation with multiple wait types
 */

import type { Command, CommandHandler, ModeConfig, WaitParams } from './types';

// ============================================================================
// Wait Utilities
// ============================================================================

async function waitForTime(duration: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, duration));
}

async function waitForSelector(
  selector: string,
  timeout: number = 5000
): Promise<Element> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) {
      // Check if element is visible
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);

      const isVisible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0';

      if (isVisible) {
        return element;
      }
    }

    // Wait before checking again
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timeout waiting for selector: ${selector}`);
}

async function waitForNavigation(timeout: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let timeoutId: ReturnType<typeof setTimeout>;

    const checkNavigation = () => {
      if (document.readyState === 'complete') {
        clearTimeout(timeoutId);
        resolve();
      } else if (Date.now() - startTime >= timeout) {
        clearTimeout(timeoutId);
        reject(new Error('Navigation timeout'));
      } else {
        timeoutId = setTimeout(checkNavigation, 100);
      }
    };

    // Listen for load event
    const onLoad = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('load', onLoad);
      resolve();
    };

    window.addEventListener('load', onLoad);

    // Start checking
    checkNavigation();
  });
}

async function waitForLoad(timeout: number = 30000): Promise<void> {
  // Wait for document.readyState to be 'complete'
  if (document.readyState === 'complete') {
    return;
  }

  return new Promise((resolve, reject) => {
    const onLoad = () => {
      window.removeEventListener('load', onLoad);
      document.removeEventListener('readystatechange', onStateChange);
      resolve();
    };

    const onStateChange = () => {
      if (document.readyState === 'complete') {
        window.removeEventListener('load', onLoad);
        document.removeEventListener('readystatechange', onStateChange);
        resolve();
      }
    };

    const timeoutId = setTimeout(() => {
      window.removeEventListener('load', onLoad);
      document.removeEventListener('readystatechange', onStateChange);
      reject(new Error('Load timeout'));
    }, timeout);

    window.addEventListener('load', onLoad);
    document.addEventListener('readystatechange', onStateChange);

    // Clear timeout when resolved
    Promise.race([
      new Promise((resolve) => {
        window.addEventListener('load', resolve, { once: true });
      }),
      new Promise((resolve) => {
        if (document.readyState === 'complete') resolve(undefined);
      }),
    ]).then(() => clearTimeout(timeoutId));
  });
}

// ============================================================================
// Wait Command Handler
// ============================================================================

export const waitCommand: CommandHandler = async (command: Command, config: ModeConfig) => {
  const params = command.params as WaitParams;
  const startTime = Date.now();

  switch (params.type) {
    case 'time': {
      if (!params.duration) {
        throw new Error('Duration is required for time wait');
      }
      await waitForTime(params.duration);
      return {
        success: true,
        type: 'time',
        duration: params.duration,
        actualDuration: Date.now() - startTime,
      };
    }

    case 'selector': {
      if (!params.selector) {
        throw new Error('Selector is required for selector wait');
      }
      const timeout = params.timeout || 5000;
      const element = await waitForSelector(params.selector, timeout);
      return {
        success: true,
        type: 'selector',
        selector: params.selector,
        found: true,
        bounds: element.getBoundingClientRect(),
        duration: Date.now() - startTime,
      };
    }

    case 'navigation': {
      const timeout = params.timeout || 30000;
      await waitForNavigation(timeout);
      return {
        success: true,
        type: 'navigation',
        url: window.location.href,
        readyState: document.readyState,
        duration: Date.now() - startTime,
      };
    }

    case 'load': {
      const timeout = params.timeout || 30000;
      await waitForLoad(timeout);
      return {
        success: true,
        type: 'load',
        url: window.location.href,
        readyState: document.readyState,
        duration: Date.now() - startTime,
      };
    }

    default:
      throw new Error(`Unknown wait type: ${params.type}`);
  }
};
