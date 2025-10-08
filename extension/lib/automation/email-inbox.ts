/**
 * Email Inbox Automation
 *
 * Opens email inbox and extracts magic links
 * - Uses cached cookies from welcome flow
 * - Searches for recent magic link emails
 * - Extracts and clicks magic links
 */

// ============================================================================
// Types
// ============================================================================

export interface EmailProviderConfig {
  email: string;
  provider: string;
  providerDomain: string;
  inboxUrl: string;
  cookieDomains: string[];
  setupComplete: boolean;
}

export interface MagicLinkEmail {
  found: boolean;
  link?: string;
  subject?: string;
  sender?: string;
}

// ============================================================================
// Email Provider-Specific Selectors
// ============================================================================

const EMAIL_SELECTORS = {
  gmail: {
    emailRow: 'tr.zA',
    emailSubject: '.bog span[data-thread-id]',
    emailBody: '.a3s',
    magicLinkPattern: /https?:\/\/[^\s<>"]+/g,
    unreadFilter: '.zE', // Unread emails
  },
  outlook: {
    emailRow: '[role="listitem"][aria-label*="message"]',
    emailSubject: '[role="heading"]',
    emailBody: '[role="document"]',
    magicLinkPattern: /https?:\/\/[^\s<>"]+/g,
    unreadFilter: '[aria-label*="Unread"]',
  },
  yahoo: {
    emailRow: '[data-test-id="message-list-item"]',
    emailSubject: '[data-test-id="message-subject"]',
    emailBody: '[data-test-id="message-view-body"]',
    magicLinkPattern: /https?:\/\/[^\s<>"]+/g,
    unreadFilter: '[aria-label*="unread"]',
  },
  proton: {
    emailRow: '.item-container',
    emailSubject: '.subject',
    emailBody: '.message-content',
    magicLinkPattern: /https?:\/\/[^\s<>"]+/g,
    unreadFilter: '.item-is-unread',
  },
  icloud: {
    emailRow: '.message',
    emailSubject: '.subject',
    emailBody: '.message-body',
    magicLinkPattern: /https?:\/\/[^\s<>"]+/g,
    unreadFilter: '.unread',
  },
};

// ============================================================================
// Magic Link Detection Patterns
// ============================================================================

const MAGIC_LINK_KEYWORDS = [
  'sign in',
  'log in',
  'login',
  'verify',
  'confirm',
  'authenticate',
  'magic link',
  'access',
  'continue',
  'verification',
  'confirmation',
];

const SUSPICIOUS_DOMAINS = [
  'unsubscribe',
  'preferences',
  'settings',
  'privacy',
  'terms',
  'policy',
];

// ============================================================================
// Email Inbox Automation
// ============================================================================

export class EmailInboxAutomation {
  private config: EmailProviderConfig | null = null;
  private inboxTabId: number | null = null;

  constructor() {
    this.loadConfig();
  }

  private async loadConfig() {
    const stored = await chrome.storage.local.get('emailProviderConfig');
    if (stored.emailProviderConfig?.setupComplete) {
      this.config = stored.emailProviderConfig;
      console.log('[EmailInbox] Loaded config:', this.config?.email);
    } else {
      console.log('[EmailInbox] No email provider configured');
    }
  }

  /**
   * Open inbox in background tab
   */
  async openInbox(): Promise<number> {
    if (!this.config) {
      throw new Error('Email provider not configured');
    }

    console.log('[EmailInbox] Opening inbox:', this.config.inboxUrl);

    const tab = await chrome.tabs.create({
      url: this.config.inboxUrl,
      active: false, // Open in background
    });

    if (!tab.id) {
      throw new Error('Failed to create inbox tab');
    }

    this.inboxTabId = tab.id;

    // Wait for inbox to load
    await this.waitForInboxLoad(tab.id);

    return tab.id;
  }

  /**
   * Wait for inbox to fully load
   */
  private async waitForInboxLoad(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Inbox load timeout'));
      }, 30000);

      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          // Wait a bit more for dynamic content
          setTimeout(resolve, 2000);
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * Search for magic link in inbox
   */
  async findMagicLink(expectedDomain?: string): Promise<MagicLinkEmail> {
    if (!this.inboxTabId || !this.config) {
      throw new Error('Inbox not open');
    }

    console.log('[EmailInbox] Searching for magic link...');

    // Get provider-specific selectors
    const provider = this.getProviderKey(this.config.provider);
    const selectors = EMAIL_SELECTORS[provider];

    if (!selectors) {
      throw new Error(`Unsupported email provider: ${this.config.provider}`);
    }

    // Inject script to find magic link
    const results = await chrome.scripting.executeScript({
      target: { tabId: this.inboxTabId },
      func: this.extractMagicLinkFromInbox,
      args: [selectors, expectedDomain],
    });

    if (!results || results.length === 0) {
      return { found: false };
    }

    const result = results[0].result as MagicLinkEmail;
    console.log('[EmailInbox] Search result:', result);

    return result;
  }

  /**
   * Injected function to extract magic link from inbox
   * (Runs in inbox tab context)
   */
  private extractMagicLinkFromInbox(
    selectors: typeof EMAIL_SELECTORS['gmail'],
    expectedDomain?: string
  ): MagicLinkEmail {
    console.log('[EmailInbox] Extracting magic link from page...');

    // Find recent unread emails (last 5)
    const emailRows = Array.from(
      document.querySelectorAll<HTMLElement>(selectors.emailRow)
    ).slice(0, 5);

    console.log('[EmailInbox] Found email rows:', emailRows.length);

    for (const row of emailRows) {
      // Click to open email (if needed)
      try {
        if (!row.classList.contains('expanded')) {
          row.click();
          // Wait a bit for email body to load
          const now = Date.now();
          while (Date.now() - now < 500) {
            // Busy wait
          }
        }
      } catch (e) {
        console.log('[EmailInbox] Could not click email row:', e);
      }

      // Get email body
      const bodyElement = row.querySelector<HTMLElement>(selectors.emailBody);
      if (!bodyElement) continue;

      const bodyText = bodyElement.textContent || '';
      const bodyHtml = bodyElement.innerHTML || '';

      // Find all links in email
      const links = Array.from(bodyElement.querySelectorAll('a[href]'))
        .map(a => (a as HTMLAnchorElement).href)
        .concat(
          (bodyText.match(selectors.magicLinkPattern) || [])
        );

      console.log('[EmailInbox] Found links:', links.length);

      // Score each link
      for (const link of links) {
        const score = this.scoreMagicLink(link, bodyText, expectedDomain);
        console.log('[EmailInbox] Link score:', link, score);

        if (score > 3) {
          // Found likely magic link!
          const subject = row.querySelector(selectors.emailSubject)?.textContent || '';

          return {
            found: true,
            link,
            subject,
            sender: 'Unknown',
          };
        }
      }
    }

    return { found: false };
  }

  /**
   * Score a link to determine if it's a magic link
   */
  private scoreMagicLink(link: string, context: string, expectedDomain?: string): number {
    let score = 0;

    // Must be HTTPS
    if (!link.startsWith('https://')) return 0;

    // Check if domain matches expected (highest confidence)
    if (expectedDomain && link.includes(expectedDomain)) {
      score += 5;
    }

    // Check for magic link keywords in surrounding text
    const lowerContext = context.toLowerCase();
    for (const keyword of MAGIC_LINK_KEYWORDS) {
      if (lowerContext.includes(keyword)) {
        score += 1;
      }
    }

    // Check for suspicious domains (unsubscribe, etc.)
    for (const suspicious of SUSPICIOUS_DOMAINS) {
      if (link.toLowerCase().includes(suspicious)) {
        score -= 5;
      }
    }

    // Check for authentication-like URL patterns
    if (/\/(verify|confirm|auth|login|signin|magic|token)/i.test(link)) {
      score += 2;
    }

    // Check for query parameters with tokens
    if (/[?&](token|code|verification|confirmation|magic)/i.test(link)) {
      score += 2;
    }

    // Long random strings in URL (likely tokens)
    if (/[a-zA-Z0-9]{32,}/.test(link)) {
      score += 1;
    }

    return score;
  }

  /**
   * Click magic link
   */
  async clickMagicLink(link: string): Promise<void> {
    if (!this.inboxTabId) {
      throw new Error('Inbox not open');
    }

    console.log('[EmailInbox] Clicking magic link:', link);

    // Navigate inbox tab to magic link
    await chrome.tabs.update(this.inboxTabId, {
      url: link,
      active: true, // Bring to front
    });

    // Clear inbox tab reference (it's now the auth page)
    this.inboxTabId = null;
  }

  /**
   * Close inbox tab
   */
  async closeInbox(): Promise<void> {
    if (this.inboxTabId) {
      try {
        await chrome.tabs.remove(this.inboxTabId);
        console.log('[EmailInbox] Closed inbox tab');
      } catch (error) {
        console.error('[EmailInbox] Error closing inbox:', error);
      }
      this.inboxTabId = null;
    }
  }

  /**
   * Get provider key for selectors
   */
  private getProviderKey(provider: string): keyof typeof EMAIL_SELECTORS {
    const normalized = provider.toLowerCase();
    if (normalized.includes('gmail')) return 'gmail';
    if (normalized.includes('outlook')) return 'outlook';
    if (normalized.includes('yahoo')) return 'yahoo';
    if (normalized.includes('proton')) return 'proton';
    if (normalized.includes('icloud')) return 'icloud';
    return 'gmail'; // Default fallback
  }

  /**
   * Full magic link automation flow
   */
  async automateLogin(expectedDomain?: string): Promise<boolean> {
    try {
      // Step 1: Open inbox
      await this.openInbox();

      // Step 2: Find magic link
      const result = await this.findMagicLink(expectedDomain);

      if (!result.found || !result.link) {
        console.log('[EmailInbox] Magic link not found');
        await this.closeInbox();
        return false;
      }

      // Step 3: Click magic link
      await this.clickMagicLink(result.link);

      // Don't close - the tab is now showing the auth page
      return true;
    } catch (error) {
      console.error('[EmailInbox] Automation error:', error);
      await this.closeInbox();
      return false;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let inboxAutomation: EmailInboxAutomation | null = null;

export function getEmailInboxAutomation(): EmailInboxAutomation {
  if (!inboxAutomation) {
    inboxAutomation = new EmailInboxAutomation();
  }
  return inboxAutomation;
}
