/**
 * Background script entry point - Agent Browser
 *
 * Refactored to use class-based architecture:
 * - BackgroundService: Main orchestrator
 * - BadgeManager: Extension badge state
 * - WebSocketClient: Rust server communication
 * - TabRouter: Content script communication
 * - PasskeyManager: WebAuthn operations
 * - LlmManager: Offscreen LLM
 * - MagicLinkManager: Email automation
 */

import { BackgroundService } from './background';

// Initialize and start the background service
const service = new BackgroundService();
service.initialize().catch(error => {
  console.error('[Background] Failed to initialize service:', error);
});

console.log('[Background] Service started');
