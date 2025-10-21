/**
 * MagicLinkManager - Handles magic link detection and email automation
 */

import { getEmailInboxAutomation } from '../../lib/automation/email-inbox';
import type { BadgeManager } from './badge-manager';

export class MagicLinkManager {
  constructor(private badgeManager: BadgeManager) {}

  /**
   * Check email provider configuration status
   */
  async checkEmailProviderStatus(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get('emailProviderConfig');

      if (stored.emailProviderConfig?.setupComplete) {
        console.log('[MagicLinkManager] Email provider configured:', stored.emailProviderConfig.email);
        this.badgeManager.setState({
          emailStatus: 'configured',
          emailAddress: stored.emailProviderConfig.email,
          emailProvider: stored.emailProviderConfig.provider
        });
      } else {
        console.log('[MagicLinkManager] Email provider not configured');
        this.badgeManager.setState({
          emailStatus: 'not_configured'
        });
      }
    } catch (error) {
      console.error('[MagicLinkManager] Error checking email provider status:', error);
      this.badgeManager.setState({
        emailStatus: 'not_configured'
      });
    }
  }

  /**
   * Handle magic link detection from content script
   */
  async handleMagicLinkDetection(message: any): Promise<void> {
    console.log('[MagicLinkManager] Magic link detected from content script:', message);

    const { email, formType, url } = message;

    // Extract domain from URL
    const domain = new URL(url).hostname;

    // Update badge: detected
    this.badgeManager.setState({
      magicLinkStatus: 'detected',
      magicLinkDomain: domain,
    });

    // Wait a bit for email to arrive
    console.log('[MagicLinkManager] Waiting 3 seconds for email to arrive...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Update badge: checking inbox
    this.badgeManager.setState({ magicLinkStatus: 'checking_inbox' });

    // Get inbox automation
    const inboxAutomation = getEmailInboxAutomation();

    // Automate login
    const success = await inboxAutomation.automateLogin(domain);

    if (success) {
      console.log('[MagicLinkManager] Magic link automation successful!');
      this.badgeManager.setState({
        magicLinkStatus: 'clicking',
      });

      // Reset after a delay
      setTimeout(() => {
        this.badgeManager.setState({ magicLinkStatus: 'idle' });
      }, 5000);
    } else {
      console.log('[MagicLinkManager] Magic link not found in inbox');
      this.badgeManager.setState({
        magicLinkStatus: 'idle',
        errorType: 'server_error',
        errorMessage: 'Magic link not found in email inbox',
      });

      // Clear error after 3 seconds
      setTimeout(() => {
        const currentState = this.badgeManager.getState();
        if (currentState.errorType === 'server_error') {
          this.badgeManager.setState({ errorType: null, errorMessage: undefined });
        }
      }, 3000);
    }
  }
}
