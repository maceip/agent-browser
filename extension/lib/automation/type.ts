/**
 * Type command implementation with speed/stealth mode support
 */

import type { Command, CommandHandler, ModeConfig, TypeParams } from './types';
import { getRandomDelay } from './mode-config';

// ============================================================================
// Element Finding Utilities
// ============================================================================

function findElement(params: TypeParams): HTMLElement | null {
  if (params.selector) {
    return document.querySelector(params.selector) as HTMLElement | null;
  }
  if (params.xpath) {
    const result = document.evaluate(
      params.xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as HTMLElement | null;
  }
  return null;
}

function isInputElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    element.isContentEditable
  );
}

// ============================================================================
// Typing Simulation
// ============================================================================

async function typeWithHumanDelay(
  element: HTMLElement,
  text: string,
  config: ModeConfig
): Promise<void> {
  const isContentEditable = element.isContentEditable;
  const isInput = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

  // Focus element
  element.focus();
  element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

  // Type each character
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Calculate typing delay
    let delay = 0;
    if (config.mode === 'stealth') {
      delay = config.stealth.humanizeTiming
        ? getRandomDelay(config.stealth.typingDelayRange)
        : config.stealth.typingDelayRange[0];
    } else if (!config.speed.immediateTyping) {
      delay = 10;
    }

    // Wait before typing character
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Dispatch key events
    let keyEventOptions;
    if (char === '\n') {
      // Handle Enter key specially
      keyEventOptions = {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      };
    } else {
      keyEventOptions = {
        key: char,
        code: `Key${char.toUpperCase()}`,
        bubbles: true,
        cancelable: true,
      };
    }

    element.dispatchEvent(new KeyboardEvent('keydown', keyEventOptions));
    element.dispatchEvent(new KeyboardEvent('keypress', keyEventOptions));

    // Update element value (skip for Enter key)
    if (char !== '\n') {
      if (isInput) {
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
        const currentValue = inputElement.value;
        inputElement.value = currentValue + char;

        // Trigger input event
        inputElement.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: char,
          inputType: 'insertText',
        }));
      } else if (isContentEditable) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(char);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          element.textContent += char;
        }

        // Trigger input event
        element.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: char,
          inputType: 'insertText',
        }));
      }
    }

    element.dispatchEvent(new KeyboardEvent('keyup', keyEventOptions));
  }

  // Trigger change event after typing
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function clearElement(element: HTMLElement, config: ModeConfig): Promise<void> {
  const isInput = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

  if (isInput) {
    // Select all
    (element as HTMLInputElement).select();

    // Dispatch events
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Backspace',
      code: 'Backspace',
      bubbles: true
    }));

    (element as HTMLInputElement).value = '';

    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'deleteContentBackward',
    }));

    element.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Backspace',
      code: 'Backspace',
      bubbles: true
    }));
  } else if (element.isContentEditable) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);

    element.textContent = '';
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'deleteContentBackward',
    }));
  }

  // Wait a bit after clearing in stealth mode
  if (config.mode === 'stealth') {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// ============================================================================
// Type Command Handler
// ============================================================================

export const typeCommand: CommandHandler = async (command: Command, config: ModeConfig) => {
  const params = command.params as TypeParams;

  // Find target element
  const element = findElement(params);
  if (!element) {
    throw new Error(
      `Element not found: ${params.selector || params.xpath || 'unknown'}`
    );
  }

  if (!isInputElement(element)) {
    throw new Error('Element is not an input, textarea, or contentEditable element');
  }

  // Scroll into view
  element.scrollIntoView({ behavior: 'auto', block: 'center' });

  // Wait for custom delay if specified
  if (params.delay) {
    await new Promise((resolve) => setTimeout(resolve, params.delay));
  }

  // Clear existing content if requested
  if (params.clear) {
    await clearElement(element, config);
  }

  // Type the text
  await typeWithHumanDelay(element, params.text, config);

  return {
    success: true,
    selector: params.selector || params.xpath,
    text: params.text,
    characterCount: params.text.length,
  };
};
