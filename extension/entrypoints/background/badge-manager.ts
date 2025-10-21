/**
 * BadgeManager - Manages extension badge state and visual feedback
 */

import type { BadgeState, CommandType } from './types';

export class BadgeManager {
  private state: BadgeState;
  private llmInitAnimationInterval: ReturnType<typeof setInterval> | null = null;
  private llmInitAnimationFrame = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;

  constructor() {
    this.state = {
      serverStatus: 'starting',
      activeCommand: null,
      errorType: null,
      reconnectAttempt: 0,
      llmStatus: 'idle',
      llmProgress: 0,
      llmDownloadedBytes: 0,
      llmTotalBytes: 0,
      emailStatus: 'not_configured',
      magicLinkStatus: 'idle',
    };
  }

  /**
   * Update badge state (partial update)
   */
  setState(updates: Partial<BadgeState>): void {
    this.state = { ...this.state, ...updates };
    this.updateBadge();
  }

  /**
   * Get current badge state
   */
  getState(): BadgeState {
    return { ...this.state };
  }

  /**
   * Update badge UI based on state
   * Priority: Error > Onboarding > Server Status (disconnected/error/reconnecting) > Magic Link > LLM > Active Command > Email Identity > Server Status (connected/starting)
   */
  private updateBadge(): void {
    if (this.state.errorType) {
      // Error state
      chrome.action.setBadgeText({ text: '⚠' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      const errorMsg = this.state.errorMessage || 'Unknown error';
      const errorDetails = [
        '⚠️ ERROR',
        `Type: ${this.state.errorType}`,
        `Message: ${errorMsg}`,
        `Time: ${new Date().toLocaleTimeString()}`,
        '',
        'Check browser console (F12) for details'
      ].join('\n');
      chrome.action.setTitle({ title: errorDetails });
      return;
    }

    // Onboarding needed badge (highest priority after errors)
    if (this.state.emailStatus === 'not_configured') {
      chrome.action.setBadgeText({ text: '⚠️' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff6b35' }); // Orange
      const onboardingInfo = [
        '👋 SETUP REQUIRED',
        '',
        'Email automation is not configured',
        '',
        '→ Click this icon to start setup',
        '→ You\'ll configure your email provider',
        '→ Enable automatic magic link login',
        '',
        'Setup takes ~2 minutes'
      ].join('\n');
      chrome.action.setTitle({ title: onboardingInfo });
      return;
    }

    // Critical server status (disconnected, error, reconnecting) - must be visible!
    if (this.state.serverStatus === 'disconnected') {
      chrome.action.setBadgeText({ text: '✗' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      const disconnectedInfo = [
        '✗ DISCONNECTED',
        '',
        'MCP Server: Not connected',
        'WebSocket: Closed',
        '',
        'Action: Start the Rust server',
        'Command: cargo run',
        '',
        'Extension will auto-reconnect when server starts'
      ].join('\n');
      chrome.action.setTitle({ title: disconnectedInfo });
      return;
    }

    if (this.state.serverStatus === 'error') {
      chrome.action.setBadgeText({ text: '✗' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      const serverErrorInfo = [
        '✗ SERVER ERROR',
        '',
        `Error: ${this.state.errorMessage || 'Unknown error'}`,
        `Time: ${new Date().toLocaleTimeString()}`,
        '',
        'Check if the Rust server is running',
        'Try restarting the server',
        '',
        'See console for details'
      ].join('\n');
      chrome.action.setTitle({ title: serverErrorInfo });
      return;
    }

    if (this.state.serverStatus === 'reconnecting') {
      chrome.action.setBadgeText({ text: `↻${this.state.reconnectAttempt}` });
      chrome.action.setBadgeBackgroundColor({ color: '#eab308' });
      const reconnectInfo = [
        `↻ RECONNECTING`,
        '',
        `Attempt: ${this.state.reconnectAttempt} / ${this.MAX_RECONNECT_ATTEMPTS}`,
        `Time: ${new Date().toLocaleTimeString()}`,
        '',
        'Status: Trying to reconnect to MCP server',
        'Websocket connection lost',
        '',
        'Will retry automatically'
      ].join('\n');
      chrome.action.setTitle({ title: reconnectInfo });
      return;
    }

    // Magic link automation states (high priority)
    if (this.state.magicLinkStatus !== 'idle') {
      switch (this.state.magicLinkStatus) {
        case 'detected':
          chrome.action.setBadgeText({ text: '🔗' });
          chrome.action.setBadgeBackgroundColor({ color: '#ff9500' }); // Orange
          const detectedInfo = [
            '🔗 MAGIC LINK DETECTED',
            '',
            `Email: ${this.state.emailAddress || 'Unknown'}`,
            `Domain: ${this.state.magicLinkDomain || 'Unknown'}`,
            `Time: ${new Date().toLocaleTimeString()}`,
            '',
            'Status: Waiting 3s for email to arrive...',
            'Next: Opening email inbox automatically'
          ].join('\n');
          chrome.action.setTitle({ title: detectedInfo });
          return;

        case 'checking_inbox':
          chrome.action.setBadgeText({ text: '📬' });
          chrome.action.setBadgeBackgroundColor({ color: '#ff9500' });
          const checkingInfo = [
            '📬 CHECKING EMAIL INBOX',
            '',
            `Provider: ${this.state.emailProvider || 'Unknown'}`,
            `Email: ${this.state.emailAddress || 'Unknown'}`,
            `Looking for: ${this.state.magicLinkDomain || 'magic link'}`,
            '',
            'Status: Searching recent emails...',
            'Automation: Opening inbox in background'
          ].join('\n');
          chrome.action.setTitle({ title: checkingInfo });
          return;

        case 'found':
          chrome.action.setBadgeText({ text: '✉️' });
          chrome.action.setBadgeBackgroundColor({ color: '#00cc88' }); // Green
          const foundInfo = [
            '✉️ MAGIC LINK FOUND',
            '',
            `Domain: ${this.state.magicLinkDomain || 'Unknown'}`,
            `Email: ${this.state.emailAddress || 'Unknown'}`,
            '',
            'Status: Magic link extracted from email',
            'Next: Clicking link automatically...'
          ].join('\n');
          chrome.action.setTitle({ title: foundInfo });
          return;

        case 'clicking':
          chrome.action.setBadgeText({ text: '👆' });
          chrome.action.setBadgeBackgroundColor({ color: '#00cc88' });
          const clickingInfo = [
            '👆 CLICKING MAGIC LINK',
            '',
            `Domain: ${this.state.magicLinkDomain || 'Unknown'}`,
            `Time: ${new Date().toLocaleTimeString()}`,
            '',
            'Status: Navigating to authentication page...',
            'You will be signed in automatically!'
          ].join('\n');
          chrome.action.setTitle({ title: clickingInfo });
          return;
      }
    }

    // LLM download progress (text-based progress indicator - purple)
    if (this.state.llmStatus === 'downloading') {
      const progress = this.state.llmProgress;
      let progressText = '';
      let progressStage = '';

      // Use text-based progress bars (no icon swapping)
      if (progress < 0.25) {
        progressText = '▱▱▱';
        progressStage = '0-25%';
      } else if (progress < 0.50) {
        progressText = '▰▱▱';
        progressStage = '25-50%';
      } else if (progress < 0.75) {
        progressText = '▰▰▱';
        progressStage = '50-75%';
      } else {
        progressText = '▰▰▰';
        progressStage = '75-100%';
      }

      const mb = (this.state.llmDownloadedBytes / (1024 * 1024)).toFixed(0);
      const totalMb = (this.state.llmTotalBytes / (1024 * 1024)).toFixed(0);
      const percentComplete = (progress * 100).toFixed(1);
      const remainingMb = Math.max(0, Number(totalMb) - Number(mb));

      chrome.action.setBadgeText({ text: progressText });
      chrome.action.setBadgeBackgroundColor({ color: '#8b5cf6' }); // Purple
      const downloadInfo = [
        `${progressText} DOWNLOADING LLM MODEL`,
        '',
        `Model: Gemma 3N-E2B IT`,
        `Progress: ${percentComplete}% complete (${progressStage})`,
        `Downloaded: ${mb} MB / ${totalMb} MB`,
        `Remaining: ${remainingMb} MB`,
        '',
        'Location: OPFS (Origin Private File System)',
        'This is a one-time download',
        '',
        'Progress: ▱▱▱ → ▰▱▱ → ▰▰▱ → ▰▰▰'
      ].join('\n');
      chrome.action.setTitle({ title: downloadInfo });
      return;
    }

    // LLM initialization progress (text-based progress indicator - yellow)
    if (this.state.llmStatus === 'initializing') {
      const progress = this.state.llmProgress;
      let progressText = '';
      let progressStage = '';

      // Use text-based progress bars (no icon swapping)
      if (progress < 0.33) {
        progressText = '▱▱▱';
        progressStage = '0-33%';
      } else if (progress < 0.67) {
        // Animate between ▰▱▱ and ▰▰▱ to show activity during long WASM compilation (33-67%)
        progressText = this.llmInitAnimationFrame % 2 === 0 ? '▰▱▱' : '▰▰▱';
        progressStage = '33-67% (compiling WASM)';

        // Start animation if not already running
        if (!this.llmInitAnimationInterval) {
          this.llmInitAnimationInterval = setInterval(() => {
            this.llmInitAnimationFrame++;
            this.updateBadge();
          }, 800); // Pulse every 800ms
        }
      } else if (progress < 0.9) {
        progressText = '▰▰▱';
        progressStage = '67-90%';
      } else {
        progressText = '▰▰▰';
        progressStage = '90-100%';
      }

      const percentComplete = (progress * 100).toFixed(1);

      chrome.action.setBadgeText({ text: progressText });
      chrome.action.setBadgeBackgroundColor({ color: '#eab308' }); // Yellow
      const initInfo = [
        `${progressText} INITIALIZING LLM`,
        '',
        `Model: Gemma 3N-E2B IT`,
        `Progress: ${percentComplete}% complete (${progressStage})`,
        '',
        'Status: Compiling WASM and loading model',
        'Runtime: MediaPipe GenAI',
        'Backend: WebGPU',
        '',
        'This may take 10-15 seconds (one-time setup)',
        'Browser remains responsive during compilation'
      ].join('\n');
      chrome.action.setTitle({ title: initInfo });
      return;
    } else {
      // Clear animation when leaving initializing state
      if (this.llmInitAnimationInterval) {
        clearInterval(this.llmInitAnimationInterval);
        this.llmInitAnimationInterval = null;
        this.llmInitAnimationFrame = 0;
      }
    }

    if (this.state.llmStatus === 'ready') {
      chrome.action.setBadgeText({ text: '✻' });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }); // Green
      const llmInfo = [
        '🤖 LLM READY',
        '',
        'Model: Gemma 3N-E2B IT',
        'Status: Initialized and ready',
        'Runtime: MediaPipe GenAI',
        'Backend: WebGPU',
        '',
        'Ready to generate responses'
      ].join('\n');
      chrome.action.setTitle({ title: llmInfo });
      return;
    }

    if (this.state.llmStatus === 'generating') {
      chrome.action.setBadgeText({ text: '💭' });
      chrome.action.setBadgeBackgroundColor({ color: '#8b5cf6' });
      const generatingInfo = [
        '💭 LLM GENERATING',
        '',
        'Model: Gemma 3N-E2B IT',
        'Status: Generating response...',
        `Time: ${new Date().toLocaleTimeString()}`,
        '',
        'Using WebGPU acceleration'
      ].join('\n');
      chrome.action.setTitle({ title: generatingInfo });
      return;
    }

    if (this.state.activeCommand) {
      // Active command
      const commandIcons: Record<NonNullable<CommandType>, string> = {
        navigate: '→',
        click: '⌖',
        type: '⌨',
        wait: '⏱',
        screenshot: '📷',
      };
      const commandNames: Record<NonNullable<CommandType>, string> = {
        navigate: 'Navigate',
        click: 'Click',
        type: 'Type',
        wait: 'Wait',
        screenshot: 'Screenshot',
      };
      chrome.action.setBadgeText({ text: commandIcons[this.state.activeCommand] });
      chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
      const commandInfo = [
        `${commandIcons[this.state.activeCommand]} ${commandNames[this.state.activeCommand].toUpperCase()} COMMAND`,
        '',
        `Command: ${this.state.activeCommand}`,
        `Started: ${new Date().toLocaleTimeString()}`,
        '',
        'Status: Executing browser automation',
        'Controlled by: MCP server'
      ].join('\n');
      chrome.action.setTitle({ title: commandInfo });
      return;
    }

    // Email identity active badge (lower priority - shows when connected and no activity)
    if (this.state.emailStatus === 'configured' && this.state.serverStatus === 'connected') {
      chrome.action.setBadgeText({ text: '👤' });
      chrome.action.setBadgeBackgroundColor({ color: '#00cc88' }); // Green
      const emailInfo = [
        '📧 EMAIL IDENTITY ACTIVE',
        '',
        `Email: ${this.state.emailAddress || 'Unknown'}`,
        `Provider: ${this.state.emailProvider || 'Unknown'}`,
        '',
        'Magic link automation is enabled',
        'Forms matching this email will auto-login',
        '',
        'Status: Monitoring for signup/signin forms'
      ].join('\n');
      chrome.action.setTitle({ title: emailInfo });
      return;
    }

    // Non-critical server status (starting, connected)
    switch (this.state.serverStatus) {
      case 'starting':
        chrome.action.setBadgeText({ text: '⋯' });
        chrome.action.setBadgeBackgroundColor({ color: '#eab308' });
        const startingInfo = [
          '⋯ SERVER STARTING',
          '',
          'Status: Initializing connection',
          'Target: ws://localhost:8085',
          '',
          'Please wait...'
        ].join('\n');
        chrome.action.setTitle({ title: startingInfo });
        break;
      case 'connected':
        chrome.action.setBadgeText({ text: '✓' });
        chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
        const connectedInfo = [
          '✓ CONNECTED',
          '',
          'MCP Server: Connected',
          'WebSocket: Active',
          `Connected at: ${new Date().toLocaleTimeString()}`,
          '',
          'Status: Ready for automation commands'
        ].join('\n');
        chrome.action.setTitle({ title: connectedInfo });
        break;
      default:
        // Fallback for any unhandled states
        chrome.action.setBadgeText({ text: '?' });
        chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
        chrome.action.setTitle({ title: 'Agent Browser - Unknown State' });
    }
  }
}
