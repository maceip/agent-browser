/**
 * DatabaseManager - Manages page and action data using IndexedDB
 *
 * Provides a SQLite-like interface for storing:
 * - Visited pages (by effective TLD)
 * - Dynamic actions for each page
 */

import type { Page, PageAction } from './schema';

const DB_NAME = 'agent_browser_dynamic_tools';
const DB_VERSION = 1;
const PAGES_STORE = 'pages';
const ACTIONS_STORE = 'page_actions';

export class DatabaseManager {
  private db: IDBDatabase | null = null;

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[DatabaseManager] Database initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create pages store
        if (!db.objectStoreNames.contains(PAGES_STORE)) {
          const pagesStore = db.createObjectStore(PAGES_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          pagesStore.createIndex('domain', 'domain', { unique: true });
        }

        // Create page_actions store
        if (!db.objectStoreNames.contains(ACTIONS_STORE)) {
          const actionsStore = db.createObjectStore(ACTIONS_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          actionsStore.createIndex('page_id', 'page_id', { unique: false });
          actionsStore.createIndex('page_action', ['page_id', 'action_name'], {
            unique: true,
          });
        }

        console.log('[DatabaseManager] Database schema created');
      };
    });
  }

  /**
   * Record a page visit (creates or updates page record)
   */
  async recordPageVisit(domain: string): Promise<Page> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const now = Date.now();

    // Try to get existing page
    const existingPage = await this.getPageByDomain(domain);

    if (existingPage) {
      // Update existing page
      const updatedPage: Page = {
        ...existingPage,
        last_visited: now,
        visit_count: existingPage.visit_count + 1,
      };

      await this.updatePage(updatedPage);
      return updatedPage;
    } else {
      // Create new page
      const newPage: Page = {
        domain,
        first_visited: now,
        last_visited: now,
        visit_count: 1,
      };

      const id = await this.insertPage(newPage);
      return { ...newPage, id };
    }
  }

  /**
   * Get page by domain
   */
  async getPageByDomain(domain: string): Promise<Page | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PAGES_STORE], 'readonly');
      const store = transaction.objectStore(PAGES_STORE);
      const index = store.index('domain');
      const request = index.get(domain);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get page: ${request.error}`));
      };
    });
  }

  /**
   * Get all pages
   */
  async getAllPages(): Promise<Page[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PAGES_STORE], 'readonly');
      const store = transaction.objectStore(PAGES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get pages: ${request.error}`));
      };
    });
  }

  /**
   * Get actions for a page
   */
  async getActionsForPage(pageId: number): Promise<PageAction[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ACTIONS_STORE], 'readonly');
      const store = transaction.objectStore(ACTIONS_STORE);
      const index = store.index('page_id');
      const request = index.getAll(pageId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get actions: ${request.error}`));
      };
    });
  }

  /**
   * Add action to a page
   */
  async addAction(action: Omit<PageAction, 'id'>): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ACTIONS_STORE], 'readwrite');
      const store = transaction.objectStore(ACTIONS_STORE);
      const request = store.add(action);

      request.onsuccess = () => {
        resolve(request.result as number);
      };

      request.onerror = () => {
        reject(new Error(`Failed to add action: ${request.error}`));
      };
    });
  }

  /**
   * Insert a new page
   */
  private async insertPage(page: Omit<Page, 'id'>): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PAGES_STORE], 'readwrite');
      const store = transaction.objectStore(PAGES_STORE);
      const request = store.add(page);

      request.onsuccess = () => {
        resolve(request.result as number);
      };

      request.onerror = () => {
        reject(new Error(`Failed to insert page: ${request.error}`));
      };
    });
  }

  /**
   * Update an existing page
   */
  private async updatePage(page: Page): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PAGES_STORE], 'readwrite');
      const store = transaction.objectStore(PAGES_STORE);
      const request = store.put(page);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to update page: ${request.error}`));
      };
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
