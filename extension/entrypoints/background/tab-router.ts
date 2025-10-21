/**
 * TabRouter - Manages communication with content scripts and tab automation
 */

import type { Message, Response } from './types';
import type { BadgeManager } from './badge-manager';

export class TabRouter {
  private automationTabGroupId: number | null = null;

  constructor(private badgeManager: BadgeManager) {}

  /**
   * Route message to active tab's content script
   */
  async routeToTab(message: Message): Promise<Response> {
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
          await this.waitForTabReady(tab.id);
        } else {
          throw new Error('No valid tab found - current tab cannot run content scripts (chrome:// or extension pages)');
        }
      }

      // Add tab to automation group if this is a navigation command (but don't fail on error)
      if (message.method === 'navigate') {
        try {
          await this.addTabToAutomationGroup(tab.id!);
        } catch (err) {
          // Tab groups might not be available in all window types - ignore error
          console.log('[TabRouter] Could not add to tab group (expected in some window types)');
        }
      }

      // For navigate commands, ensure we wait for the page to load
      if (message.method === 'navigate') {
        await this.waitForTabReady(tab.id!);
      }

      // Check if content script is loaded
      let isLoaded = await this.checkContentScript(tab.id);

      if (!isLoaded) {
        console.log('[TabRouter] Content script not loaded, injecting...');
        try {
          await this.injectContentScript(tab.id);
          // Wait a bit longer for script to initialize
          await new Promise(resolve => setTimeout(resolve, 200));

          // Verify it loaded
          isLoaded = await this.checkContentScript(tab.id);
          if (!isLoaded) {
            throw new Error('Content script injected but not responding');
          }
        } catch (injectError) {
          this.badgeManager.setState({
            errorType: 'injection_failed',
            errorMessage: 'Failed to inject content script',
          });
          // Clear error after 3 seconds
          setTimeout(() => {
            const currentState = this.badgeManager.getState();
            if (currentState.errorType === 'injection_failed') {
              this.badgeManager.setState({ errorType: null, errorMessage: undefined });
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
      console.error('[TabRouter] Error routing message:', error);

      // Set timeout error badge if it was a timeout
      if (error.message === 'Request timeout') {
        this.badgeManager.setState({
          errorType: 'timeout',
          errorMessage: 'Request timed out after 30s',
        });
        // Clear error after 3 seconds
        setTimeout(() => {
          const currentState = this.badgeManager.getState();
          if (currentState.errorType === 'timeout') {
            this.badgeManager.setState({ errorType: null, errorMessage: undefined });
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

  /**
   * Wait for tab to finish loading
   */
  private async waitForTabReady(tabId: number): Promise<void> {
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

  /**
   * Check if content script is loaded in a tab
   */
  private async checkContentScript(tabId: number): Promise<boolean> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
      return response?.pong === true;
    } catch {
      return false;
    }
  }

  /**
   * Inject content script into a tab
   */
  private async injectContentScript(tabId: number): Promise<void> {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });

      // Wait a bit for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('[TabRouter] Failed to inject content script:', error);
      throw error;
    }
  }

  /**
   * Ensure automation tab group exists
   */
  private async ensureAutomationTabGroup(): Promise<number> {
    if (this.automationTabGroupId !== null) {
      try {
        // Verify group still exists
        await chrome.tabGroups.get(this.automationTabGroupId);
        return this.automationTabGroupId;
      } catch {
        // Group was deleted, create new one
        this.automationTabGroupId = null;
      }
    }

    // Tab groups are created when we add the first tab to them
    // So we'll just return -1 here and create it when adding the first tab
    return -1;
  }

  /**
   * Add tab to automation group
   */
  private async addTabToAutomationGroup(tabId: number): Promise<void> {
    try {
      let groupId = await this.ensureAutomationTabGroup();

      if (groupId === -1) {
        // Create new group with this tab
        groupId = await chrome.tabs.group({ tabIds: tabId });
        await chrome.tabGroups.update(groupId, {
          title: 'Agent Browser',
          color: 'blue',
          collapsed: false,
        });
        this.automationTabGroupId = groupId;
      } else {
        // Add to existing group
        await chrome.tabs.group({ tabIds: tabId, groupId });
      }
    } catch (error) {
      console.error('[TabRouter] Failed to add tab to automation group:', error);
    }
  }

  /**
   * Setup event listeners for automatic content script injection
   */
  setupEventListeners(): void {
    // Handle tab updates (re-inject if needed)
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        // Proactively inject content script on page load
        const isLoaded = await this.checkContentScript(tabId);
        if (!isLoaded) {
          console.log('[TabRouter] Injecting content script into tab', tabId);
          try {
            await this.injectContentScript(tabId);
          } catch (error) {
            console.error('[TabRouter] Failed to inject content script:', error);
          }
        }
      }
    });
  }
}
