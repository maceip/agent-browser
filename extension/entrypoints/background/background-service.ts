/**
 * BackgroundService - Main orchestrator for background script
 * Coordinates all managers and handles event routing
 */

import { McpServer } from '../../lib/mcp';
import { BadgeManager } from './badge-manager';
import { WebSocketClient } from './websocket-client';
import { TabRouter } from './tab-router';
import { PasskeyManager } from './passkey-manager';
import { LlmManager } from './llm-manager';
import { MagicLinkManager } from './magic-link-manager';
import { ScreenshotHandler } from './screenshot-handler';
import { PageTracker } from './page-tracker';

export class BackgroundService {
  private badgeManager: BadgeManager;
  private websocketClient: WebSocketClient;
  private tabRouter: TabRouter;
  private passkeyManager: PasskeyManager;
  private llmManager: LlmManager;
  private magicLinkManager: MagicLinkManager;
  private screenshotHandler: ScreenshotHandler;
  private pageTracker: PageTracker;
  private mcpServer: McpServer | null = null;

  constructor() {
    // Initialize all managers
    this.badgeManager = new BadgeManager();
    this.websocketClient = new WebSocketClient(this.badgeManager);
    this.tabRouter = new TabRouter(this.badgeManager);
    this.passkeyManager = new PasskeyManager();
    this.llmManager = new LlmManager(this.badgeManager);
    this.magicLinkManager = new MagicLinkManager(this.badgeManager);
    this.screenshotHandler = new ScreenshotHandler();
    this.pageTracker = new PageTracker();
  }

  /**
   * Initialize the background service
   */
  async initialize(): Promise<void> {
    console.log('[BackgroundService] Initializing...');

    // Initialize page tracker database
    await this.pageTracker.initialize();

    // Initialize passkey manager
    await this.passkeyManager.initialize();

    // Check email provider status
    await this.magicLinkManager.checkEmailProviderStatus();

    // Initialize MCP server
    this.initializeMcpServer();

    // Setup event listeners
    this.setupEventListeners();

    // Setup offscreen document for LLM (but don't init LLM to avoid freeze)
    await this.llmManager.setupOffscreenDocument().catch(err => {
      console.error('[BackgroundService] Failed to create offscreen document:', err);
    });

    // Ensure server is running
    await this.websocketClient.ensureServerRunning();

    console.log('[BackgroundService] Initialized');
  }

  /**
   * Initialize MCP server with handler functions
   */
  private initializeMcpServer(): void {
    // Tab router - routes commands to content script
    const tabRouter = async (method: string, args: any) => {
      const message = {
        id: crypto.randomUUID(),
        method,
        params: args,
      };
      const response = await this.tabRouter.routeToTab(message);
      if (response.success) {
        return response.result;
      } else {
        throw new Error(response.error || 'Tab routing failed');
      }
    };

    // Screenshot handler
    const screenshotHandler = async (args: any) => {
      const message = {
        id: crypto.randomUUID(),
        method: 'screenshot',
        params: args,
      };
      const response = await this.screenshotHandler.handleScreenshot(message);
      if (response.success) {
        return response.result;
      } else {
        throw new Error(response.error || 'Screenshot failed');
      }
    };

    // Passkey handler
    const passkeyHandler = async (operation: string, args: any) => {
      const message = {
        id: crypto.randomUUID(),
        method: `passkey_${operation}`,
        params: args,
      };

      let response;
      switch (operation) {
        case 'enable':
          response = await this.passkeyManager.handleEnable(message);
          break;
        case 'status':
          response = await this.passkeyManager.handleStatus(message);
          break;
        case 'list':
          response = await this.passkeyManager.handleList(message);
          break;
        case 'clear':
          response = await this.passkeyManager.handleClear(message);
          break;
        default:
          throw new Error(`Unknown passkey operation: ${operation}`);
      }

      if (response.success) {
        return response.result;
      } else {
        throw new Error(response.error || 'Passkey operation failed');
      }
    };

    // Credential store proxy - sends requests back to Rust server
    const credentialStoreProxy = async (operation: string, args: any) => {
      // For now, these operations are still handled by the Rust server
      // We send a special message type back to the server
      const message = {
        type: 'credential_store_operation',
        operation,
        args,
      };

      if (this.websocketClient.isConnected()) {
        // Send request and wait for response
        // Note: This is a simplified version - in production you'd want proper request/response matching
        return new Promise((resolve, reject) => {
          const requestId = crypto.randomUUID();
          // This is a workaround - ideally WebSocketClient would expose a method for this
          // For now, we'll throw an error since this functionality isn't fully implemented yet
          reject(new Error('Credential store proxy not fully implemented - handled by Rust server'));
        });
      } else {
        throw new Error('WebSocket not connected');
      }
    };

    this.mcpServer = new McpServer(
      tabRouter,
      screenshotHandler,
      passkeyHandler,
      credentialStoreProxy
    );

    // Give MCP server to WebSocket client
    this.websocketClient.setMcpServer(this.mcpServer);

    // Register page tracker with MCP server for dynamic tools
    this.mcpServer.setPageTracker(this.pageTracker);

    console.log('[BackgroundService] MCP server initialized with dynamic tools support');
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    // Chrome runtime messages (from offscreen, content scripts, popup)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleRuntimeMessage(message, sender, sendResponse);
      return true; // Keep channel open for async responses
    });

    // Tab router event listeners (auto content script injection)
    this.tabRouter.setupEventListeners();

    // Extension icon click
    chrome.action.onClicked.addListener(async () => {
      console.log('[BackgroundService] Extension icon clicked');

      const badgeState = this.badgeManager.getState();

      // If onboarding needed, open welcome page
      if (badgeState.emailStatus === 'not_configured') {
        console.log('[BackgroundService] Opening welcome page for onboarding');
        await chrome.tabs.create({
          url: chrome.runtime.getURL('welcome.html'),
          active: true
        });
        return;
      }

      // Otherwise, ensure server is running (for debugging)
      if (!this.websocketClient.isConnected()) {
        console.log('[BackgroundService] Reconnecting to server');
        await this.websocketClient.ensureServerRunning();
      }
    });

    // First install - welcome page
    chrome.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === 'install') {
        console.log('[BackgroundService] First install detected, opening welcome page');

        // Check if already configured
        const stored = await chrome.storage.local.get('emailProviderConfig');
        if (stored.emailProviderConfig?.setupComplete) {
          console.log('[BackgroundService] Email provider already configured');
          return;
        }

        // Open welcome page
        await chrome.tabs.create({
          url: chrome.runtime.getURL('welcome.html'),
          active: true
        });
      } else if (details.reason === 'update') {
        console.log('[BackgroundService] Extension updated to version', chrome.runtime.getManifest().version);
      }
    });
  }

  /**
   * Handle runtime messages from various sources
   */
  private handleRuntimeMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): void {
    // Handle messages from offscreen document
    if (this.llmManager.isOffscreenMessage(sender)) {
      this.llmManager.handleOffscreenMessage(message);
      return;
    }

    // Handle test LLM request from popup
    if (message.type === 'test_llm') {
      this.llmManager.handleTestLlm(message.prompt);
      return;
    }

    // Handle check LLM status from popup
    if (message.type === 'check_llm_status') {
      sendResponse(this.llmManager.getStatus());
      return;
    }

    // Handle page visit tracking from content script
    if (message.type === 'page_visit') {
      this.pageTracker.recordVisit(message.url).then(result => {
        console.log(`[BackgroundService] Page visit tracked: ${result.toolName}`);
        sendResponse({ success: true, ...result });
      }).catch(error => {
        console.error('[BackgroundService] Error tracking page visit:', error);
        sendResponse({ success: false, error: error.message });
      });
      return;
    }

    // Handle messages from content scripts
    if (message.type === 'magic_link_detected') {
      this.magicLinkManager.handleMagicLinkDetection(message).catch(error => {
        console.error('[BackgroundService] Error handling magic link:', error);
        this.badgeManager.setState({
          magicLinkStatus: 'idle',
          errorType: 'server_error',
          errorMessage: 'Magic link automation failed',
        });
      });
      return;
    }
  }
}
