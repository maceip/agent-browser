/**
 * LlmManager - Manages offscreen document and LLM operations
 */

import type { BadgeManager } from './badge-manager';

export class LlmManager {
  private offscreenReady = false;

  constructor(private badgeManager: BadgeManager) {}

  /**
   * Setup offscreen document for LLM worker
   */
  async setupOffscreenDocument(): Promise<void> {
    const offscreenUrl = chrome.runtime.getURL('offscreen.html');
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });

    if (existingContexts.length > 0) {
      console.log('[LlmManager] Offscreen document already exists');
      return;
    }

    console.log('[LlmManager] Creating offscreen document...');
    await chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['WORKERS' as chrome.offscreen.Reason],
      justification: 'Run LLM inference using MediaPipe WebAssembly',
    });

    console.log('[LlmManager] Offscreen document created');
  }

  /**
   * Initialize LLM
   */
  async initializeLlm(): Promise<void> {
    console.log('[LlmManager] Initializing LLM...');

    try {
      await this.setupOffscreenDocument();

      // Send init message to offscreen
      const response = await chrome.runtime.sendMessage({
        type: 'llm_init',
        modelUrl: 'https://storage.googleapis.com/ktex-static/gemma-3n-E2B-it-int4-Web.litertlm'
      });

      if (response?.success) {
        console.log('[LlmManager] LLM initialization started');
      } else {
        console.error('[LlmManager] LLM initialization failed:', response?.error);
      }
    } catch (error) {
      console.error('[LlmManager] Failed to initialize LLM:', error);
    }
  }

  /**
   * Handle message from offscreen document
   */
  handleOffscreenMessage(message: any): void {
    console.log('[LlmManager] Message from offscreen:', message.type);

    switch (message.type) {
      case 'llm_progress':
        console.log('[LlmManager] LLM progress:', message.stage, message.progress, message.downloadedBytes, message.totalBytes);
        this.badgeManager.setState({
          llmStatus: message.stage === 'initializing' ? 'initializing' : 'downloading',
          llmProgress: message.progress || 0,
          llmDownloadedBytes: message.downloadedBytes || 0,
          llmTotalBytes: message.totalBytes || 0,
        });
        // Forward to popup
        chrome.runtime.sendMessage(message).catch(() => {});
        break;

      case 'llm_ready':
        this.offscreenReady = true;
        this.badgeManager.setState({
          llmStatus: 'ready',
          llmProgress: 1,
        });
        console.log('[LlmManager] LLM is ready');
        // Forward to popup
        chrome.runtime.sendMessage(message).catch(() => {});
        break;

      case 'llm_chunk':
        // Forward to MCP server via WebSocket if needed
        console.log('[LlmManager] LLM chunk:', message.text?.substring(0, 50));
        break;

      case 'llm_response_chunk':
        // Forward to popup (broadcast to all extension contexts)
        chrome.runtime.sendMessage(message).catch(() => {});
        break;

      case 'llm_response_complete':
        this.badgeManager.setState({ llmStatus: 'ready' });
        // Forward to popup
        chrome.runtime.sendMessage(message).catch(() => {});
        break;

      case 'llm_complete':
        this.badgeManager.setState({ llmStatus: 'ready' });
        console.log('[LlmManager] LLM generation complete');
        break;

      case 'llm_error':
        this.badgeManager.setState({
          llmStatus: 'error',
          errorType: 'server_error',
          errorMessage: message.error || 'LLM error',
        });
        console.error('[LlmManager] LLM error:', message.error);
        // Forward to popup
        chrome.runtime.sendMessage(message).catch(() => {});
        break;

      case 'worker_test_result':
        console.log('🔬 [LlmManager] Worker Test Result:', message.available ? '✅ AVAILABLE' : '❌ NOT AVAILABLE');
        console.log('🔬 [LlmManager] Details:', message.details);
        break;
    }
  }

  /**
   * Handle test LLM request from popup
   */
  async handleTestLlm(prompt: string): Promise<void> {
    console.log('[LlmManager] Test LLM request:', prompt);

    const llmStatus = this.badgeManager.getState().llmStatus;

    // Check if LLM is ready, if not initialize it first
    if (llmStatus === 'idle' || llmStatus === 'error') {
      console.log('[LlmManager] LLM not initialized - starting initialization');
      this.badgeManager.setState({ llmStatus: 'downloading' });

      // Initialize LLM first
      await this.initializeLlm();
      console.log('[LlmManager] LLM initialized, now sending prompt');

      // Wait a bit for ready message
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'generate', prompt }).catch(err => {
          console.error('[LlmManager] Failed to send to offscreen:', err);
        });
      }, 1000);
    } else if (llmStatus === 'ready') {
      // LLM already ready, send immediately
      this.badgeManager.setState({ llmStatus: 'generating' });
      chrome.runtime.sendMessage({ type: 'generate', prompt }).catch(err => {
        console.error('[LlmManager] Failed to send to offscreen:', err);
      });
    } else {
      // LLM is still loading/downloading
      console.log('[LlmManager] LLM still loading, queuing prompt...');
      // Queue the prompt to send after ready
      const readyListener = (msg: any) => {
        if (msg.type === 'llm_ready') {
          chrome.runtime.onMessage.removeListener(readyListener);
          chrome.runtime.sendMessage({ type: 'generate', prompt }).catch(err => {
            console.error('[LlmManager] Failed to send to offscreen:', err);
          });
        }
      };
      chrome.runtime.onMessage.addListener(readyListener);
    }
  }

  /**
   * Handle check LLM status request
   */
  getStatus(): { ready: boolean; status: string; progress: number } {
    const state = this.badgeManager.getState();
    return {
      ready: this.offscreenReady,
      status: state.llmStatus,
      progress: state.llmProgress
    };
  }

  /**
   * Check if message is from offscreen document
   */
  isOffscreenMessage(sender: chrome.runtime.MessageSender): boolean {
    return sender.url === chrome.runtime.getURL('offscreen.html');
  }
}
