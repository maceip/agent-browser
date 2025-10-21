/**
 * Database Schema for Dynamic MCP Tools
 *
 * This schema supports:
 * - Tracking visited pages by effective TLD
 * - Storing dynamic actions for each page
 * - Supporting the page_{site} MCP tool pattern
 */

export interface Page {
  id?: number;
  domain: string;           // Effective TLD (e.g., "aol.com", "news.com")
  first_visited: number;    // Unix timestamp
  last_visited: number;     // Unix timestamp
  visit_count: number;      // Number of visits
}

export interface PageAction {
  id?: number;
  page_id: number;          // Foreign key to pages.id
  action_name: string;      // e.g., "login", "search", "post_comment"
  action_type: string;      // e.g., "click", "fill", "navigate"
  selector?: string;        // CSS selector for the action
  description: string;      // Human-readable description
  parameters?: string;      // JSON string of parameters schema
  created_at: number;       // Unix timestamp
}

export const DB_SCHEMA = `
  -- Pages table: tracks visited domains by effective TLD
  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    first_visited INTEGER NOT NULL,
    last_visited INTEGER NOT NULL,
    visit_count INTEGER NOT NULL DEFAULT 1
  );

  -- Create index on domain for fast lookups
  CREATE INDEX IF NOT EXISTS idx_pages_domain ON pages(domain);

  -- Page actions table: stores available actions for each page
  CREATE TABLE IF NOT EXISTS page_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL,
    action_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    selector TEXT,
    description TEXT NOT NULL,
    parameters TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    UNIQUE(page_id, action_name)
  );

  -- Create index on page_id for fast action lookups
  CREATE INDEX IF NOT EXISTS idx_page_actions_page_id ON page_actions(page_id);
`;
