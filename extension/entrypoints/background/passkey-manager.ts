/**
 * PasskeyManager - Manages WebAuthn passkey operations
 */

import { WebAuthnProxy } from '../../lib/webauthn/proxy';
import type { Message, Response } from './types';

export class PasskeyManager {
  private webAuthnProxy: WebAuthnProxy | null = null;

  /**
   * Initialize the WebAuthn proxy
   */
  async initialize(): Promise<void> {
    try {
      this.webAuthnProxy = new WebAuthnProxy();
      await this.webAuthnProxy.initialize();
      console.log('[PasskeyManager] WebAuthn proxy initialized');
    } catch (error) {
      console.error('[PasskeyManager] Failed to initialize WebAuthn proxy:', error);
      this.webAuthnProxy = null;
    }
  }

  /**
   * Handle passkey enable/disable
   */
  async handleEnable(message: Message): Promise<Response> {
    try {
      if (!this.webAuthnProxy) {
        throw new Error('WebAuthn proxy not initialized');
      }

      const enabled = message.params?.enabled ?? true;
      this.webAuthnProxy.enableAutomation(enabled);

      return {
        id: message.id,
        success: true,
        result: {
          enabled,
          message: `Passkey automation ${enabled ? 'enabled' : 'disabled'}`
        }
      };
    } catch (error: any) {
      console.error('[PasskeyManager] Passkey enable error:', error);
      return {
        id: message.id,
        success: false,
        error: error.message || 'Failed to enable passkey automation',
      };
    }
  }

  /**
   * Get passkey status
   */
  async handleStatus(message: Message): Promise<Response> {
    try {
      if (!this.webAuthnProxy) {
        return {
          id: message.id,
          success: true,
          result: {
            attached: false,
            automationMode: false,
            credentialsCount: 0,
            error: 'WebAuthn proxy not initialized'
          }
        };
      }

      const status = this.webAuthnProxy.getStatus();

      return {
        id: message.id,
        success: true,
        result: status
      };
    } catch (error: any) {
      console.error('[PasskeyManager] Passkey status error:', error);
      return {
        id: message.id,
        success: false,
        error: error.message || 'Failed to get passkey status',
      };
    }
  }

  /**
   * List stored passkeys
   */
  async handleList(message: Message): Promise<Response> {
    try {
      if (!this.webAuthnProxy) {
        throw new Error('WebAuthn proxy not initialized');
      }

      const credentials = this.webAuthnProxy.getStoredCredentials();

      return {
        id: message.id,
        success: true,
        result: {
          credentials,
          count: credentials.length
        }
      };
    } catch (error: any) {
      console.error('[PasskeyManager] Passkey list error:', error);
      return {
        id: message.id,
        success: false,
        error: error.message || 'Failed to list passkeys',
      };
    }
  }

  /**
   * Clear all stored passkeys
   */
  async handleClear(message: Message): Promise<Response> {
    try {
      if (!this.webAuthnProxy) {
        throw new Error('WebAuthn proxy not initialized');
      }

      this.webAuthnProxy.clearStoredCredentials();

      return {
        id: message.id,
        success: true,
        result: {
          message: 'All stored passkeys cleared'
        }
      };
    } catch (error: any) {
      console.error('[PasskeyManager] Passkey clear error:', error);
      return {
        id: message.id,
        success: false,
        error: error.message || 'Failed to clear passkeys',
      };
    }
  }
}
