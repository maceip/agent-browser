/**
 * Click command implementation with speed/stealth mode support
 */

import type { Command, CommandHandler, ModeConfig, ClickParams } from './types';
import { getRandomDelay } from './mode-config';

// ============================================================================
// Element Finding Utilities
// ============================================================================

function findElement(params: ClickParams): Element | null {
  if (params.selector) {
    return document.querySelector(params.selector);
  }
  if (params.xpath) {
    const result = document.evaluate(
      params.xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element | null;
  }
  return null;
}

function isElementVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    style.opacity !== '0'
  );
}

function scrollIntoView(element: Element, behavior: ScrollBehavior = 'auto'): void {
  element.scrollIntoView({ behavior, block: 'center', inline: 'center' });
}

// ============================================================================
// Click Simulation
// ============================================================================

async function simulateHumanClick(
  element: Element,
  config: ModeConfig,
  button: 'left' | 'right' | 'middle' = 'left',
  clickCount: number = 1
): Promise<void> {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  // In stealth mode, add random offset
  let clientX = x;
  let clientY = y;

  if (config.mode === 'stealth' && config.stealth.simulateBehavior) {
    const offsetX = (Math.random() - 0.5) * rect.width * 0.3;
    const offsetY = (Math.random() - 0.5) * rect.height * 0.3;
    clientX += offsetX;
    clientY += offsetY;
  }

  const mouseButton = button === 'left' ? 0 : button === 'right' ? 2 : 1;

  // Simulate mouse events
  const eventOptions = {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button: mouseButton,
    buttons: 1 << mouseButton,
  };

  // Mouse down
  element.dispatchEvent(new MouseEvent('mousedown', eventOptions));

  // Wait for stealth mode
  if (config.mode === 'stealth') {
    const delay = getRandomDelay([20, 80]);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Mouse up
  element.dispatchEvent(new MouseEvent('mouseup', eventOptions));

  // Click
  for (let i = 0; i < clickCount; i++) {
    element.dispatchEvent(new MouseEvent('click', eventOptions));
    if (i < clickCount - 1 && config.mode === 'stealth') {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

async function clickAtCoordinates(
  x: number,
  y: number,
  config: ModeConfig,
  button: 'left' | 'right' | 'middle' = 'left',
  clickCount: number = 1
): Promise<void> {
  const element = document.elementFromPoint(x, y);
  if (!element) {
    throw new Error(`No element found at coordinates (${x}, ${y})`);
  }

  await simulateHumanClick(element, config, button, clickCount);
}

// ============================================================================
// Click Command Handler
// ============================================================================

export const clickCommand: CommandHandler = async (command: Command, config: ModeConfig) => {
  const params = command.params as ClickParams;

  // Coordinate-based click
  if (params.x !== undefined && params.y !== undefined) {
    await clickAtCoordinates(
      params.x,
      params.y,
      config,
      params.button,
      params.clickCount
    );
    return {
      success: true,
      coordinates: { x: params.x, y: params.y },
    };
  }

  // Selector-based click
  const element = findElement(params);
  if (!element) {
    throw new Error(
      `Element not found: ${params.selector || params.xpath || 'unknown'}`
    );
  }

  if (!isElementVisible(element)) {
    throw new Error('Element not visible');
  }

  // Scroll into view
  const behavior = config.speed.skipAnimations ? 'auto' : 'smooth';
  scrollIntoView(element, behavior);

  // Wait for scroll if in stealth mode
  if (config.mode === 'stealth') {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Wait for custom delay if specified
  if (params.delay) {
    await new Promise((resolve) => setTimeout(resolve, params.delay));
  }

  // Perform click
  await simulateHumanClick(element, config, params.button, params.clickCount);

  return {
    success: true,
    selector: params.selector || params.xpath,
    bounds: element.getBoundingClientRect(),
  };
};
