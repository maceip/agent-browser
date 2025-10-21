/**
 * PageTracker - Tracks visited pages and manages dynamic tools
 */

import { DatabaseManager } from '../../lib/database';
import { extractEffectiveTLD, tldToToolName } from '../../lib/utils/tld-extractor';

export class PageTracker {
  private dbManager: DatabaseManager;

  constructor() {
    this.dbManager = new DatabaseManager();
  }

  /**
   * Initialize the page tracker
   */
  async initialize(): Promise<void> {
    await this.dbManager.initialize();
    console.log('[PageTracker] Initialized');
  }

  /**
   * Record a page visit
   *
   * @param url - The URL that was visited
   * @returns The effective TLD and tool name
   */
  async recordVisit(url: string): Promise<{ effectiveTLD: string; toolName: string }> {
    try {
      const effectiveTLD = extractEffectiveTLD(url);
      const toolName = tldToToolName(effectiveTLD);

      // Record in database
      await this.dbManager.recordPageVisit(effectiveTLD);

      console.log(`[PageTracker] Recorded visit: ${url} → ${effectiveTLD} (${toolName})`);

      return { effectiveTLD, toolName };
    } catch (error) {
      console.error('[PageTracker] Failed to record visit:', error);
      throw error;
    }
  }

  /**
   * Get all tracked pages
   */
  async getAllPages() {
    return await this.dbManager.getAllPages();
  }

  /**
   * Get actions for a specific page
   */
  async getPageActions(pageId: number) {
    return await this.dbManager.getActionsForPage(pageId);
  }

  /**
   * Get page by domain
   */
  async getPageByDomain(domain: string) {
    return await this.dbManager.getPageByDomain(domain);
  }

  /**
   * Add an action to a page
   */
  async addPageAction(
    domain: string,
    actionName: string,
    actionType: string,
    description: string,
    selector?: string,
    parameters?: Record<string, any>
  ) {
    const page = await this.dbManager.getPageByDomain(domain);
    if (!page || !page.id) {
      throw new Error(`Page not found: ${domain}`);
    }

    await this.dbManager.addAction({
      page_id: page.id,
      action_name: actionName,
      action_type: actionType,
      selector,
      description,
      parameters: parameters ? JSON.stringify(parameters) : undefined,
      created_at: Date.now(),
    });

    console.log(`[PageTracker] Added action '${actionName}' to ${domain}`);
  }
}
