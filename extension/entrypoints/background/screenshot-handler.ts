/**
 * ScreenshotHandler - Handles screenshot capture
 */

import type { Message, Response } from './types';

export class ScreenshotHandler {
  /**
   * Capture screenshot of active tab
   */
  async handleScreenshot(message: Message): Promise<Response> {
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
      console.error('[ScreenshotHandler] Screenshot error:', error);
      return {
        id: message.id,
        success: false,
        error: error.message || 'Screenshot failed',
      };
    }
  }
}
