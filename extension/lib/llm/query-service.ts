/**
 * LLM Query Service
 *
 * Provides LLM query capabilities to content scripts and Rust server
 * for agent assistance when automation tasks fail or agents get stuck.
 */

// ============================================================================
// Types
// ============================================================================

export interface LlmQueryRequest {
  prompt: string;
  context?: {
    url?: string;
    error?: string;
    attempt?: number;
    command?: string;
    selector?: string;
  };
}

export interface LlmQueryResponse {
  response: string;
  confidence?: number;
}

export interface LlmQuery {
  id: string;
  prompt: string;
  resolve: (response: string) => void;
  reject: (error: Error) => void;
  chunks: string[];
  timeout?: ReturnType<typeof setTimeout>;
}

// ============================================================================
// LLM Query Manager
// ============================================================================

export class LlmQueryManager {
  private activeQueries: Map<string, LlmQuery> = new Map();
  private queryTimeout: number = 30000; // 30 seconds

  /**
   * Query the LLM for assistance
   */
  async query(request: LlmQueryRequest): Promise<string> {
    const queryId = this.generateQueryId();
    const prompt = this.buildPrompt(request);

    console.log('[LLM] Querying LLM:', prompt.substring(0, 100));

    return new Promise((resolve, reject) => {
      // Create query entry
      const query: LlmQuery = {
        id: queryId,
        prompt,
        resolve,
        reject,
        chunks: [],
      };

      // Set timeout
      query.timeout = setTimeout(() => {
        if (this.activeQueries.has(queryId)) {
          this.activeQueries.delete(queryId);
          reject(new Error('LLM query timeout after 30s'));
        }
      }, this.queryTimeout);

      this.activeQueries.set(queryId, query);

      // Send request to background script
      chrome.runtime.sendMessage({
        type: 'llm_query_request',
        id: queryId,
        prompt,
      }).then(response => {
        if (!response.success) {
          this.activeQueries.delete(queryId);
          reject(new Error(response.error || 'LLM query failed'));
        }
      }).catch(error => {
        this.activeQueries.delete(queryId);
        reject(error);
      });
    });
  }

  /**
   * Handle LLM chunk from background
   */
  handleChunk(id: string, text: string): void {
    const query = this.activeQueries.get(id);
    if (query) {
      query.chunks.push(text);
    }
  }

  /**
   * Handle LLM completion from background
   */
  handleComplete(id: string): void {
    const query = this.activeQueries.get(id);
    if (query) {
      const fullResponse = query.chunks.join('');
      if (query.timeout) {
        clearTimeout(query.timeout);
      }
      query.resolve(fullResponse);
      this.activeQueries.delete(id);
    }
  }

  /**
   * Handle LLM error from background
   */
  handleError(id: string, error: string): void {
    const query = this.activeQueries.get(id);
    if (query) {
      if (query.timeout) {
        clearTimeout(query.timeout);
      }
      query.reject(new Error(error));
      this.activeQueries.delete(id);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateQueryId(): string {
    return `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private buildPrompt(request: LlmQueryRequest): string {
    let prompt = request.prompt;

    // Add context if provided
    if (request.context) {
      const { url, error, attempt, command, selector } = request.context;

      const contextParts: string[] = [];

      if (url) contextParts.push(`Current URL: ${url}`);
      if (command) contextParts.push(`Command: ${command}`);
      if (selector) contextParts.push(`Selector: ${selector}`);
      if (attempt) contextParts.push(`Attempt: ${attempt}`);
      if (error) contextParts.push(`Error: ${error}`);

      if (contextParts.length > 0) {
        prompt = `Context:\n${contextParts.join('\n')}\n\nQuestion:\n${prompt}`;
      }
    }

    return prompt;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let llmQueryManager: LlmQueryManager | null = null;

export function getLlmQueryManager(): LlmQueryManager {
  if (!llmQueryManager) {
    llmQueryManager = new LlmQueryManager();
  }
  return llmQueryManager;
}

// ============================================================================
// Helper Functions for Common Scenarios
// ============================================================================

/**
 * Ask LLM for help when an element cannot be found
 */
export async function askElementNotFound(selector: string, url: string): Promise<string> {
  const manager = getLlmQueryManager();

  return manager.query({
    prompt: `I cannot find an element with selector "${selector}".

Please suggest:
1. Alternative selectors to try (CSS, XPath)
2. Common reasons why this element might not be visible
3. Steps to debug this issue

Keep response concise and actionable.`,
    context: {
      url,
      selector,
      command: 'click',
    },
  });
}

/**
 * Ask LLM for help when automation gets stuck
 */
export async function askAutomationStuck(
  command: string,
  error: string,
  attempt: number,
  url: string
): Promise<string> {
  const manager = getLlmQueryManager();

  return manager.query({
    prompt: `Automation is stuck on command "${command}".

Error: ${error}
This is attempt ${attempt}.

Please suggest:
1. What might be causing this failure
2. Alternative approaches to try
3. Whether I should retry or give up

Keep response concise and actionable.`,
    context: {
      url,
      command,
      error,
      attempt,
    },
  });
}

/**
 * Ask LLM for help understanding a page structure
 */
export async function askPageStructure(url: string, goal: string): Promise<string> {
  const manager = getLlmQueryManager();

  return manager.query({
    prompt: `I'm trying to: ${goal}

The page might have:
- Dynamic content loading
- Shadow DOM elements
- iframe content
- React/Vue components

Please suggest:
1. Common patterns for this type of page
2. What to look for in the DOM
3. Strategies for interacting with dynamic content

Keep response concise and actionable.`,
    context: {
      url,
    },
  });
}

/**
 * Ask LLM for GDPR/cookie modal help
 */
export async function askModalHelp(url: string, modalType?: string): Promise<string> {
  const manager = getLlmQueryManager();

  return manager.query({
    prompt: `I detected a ${modalType || 'modal'} on this page but cannot dismiss it.

Please suggest:
1. Common button text/selectors for dismissing this type of modal
2. Alternative dismissal methods (ESC key, backdrop click, etc.)
3. Whether this modal should be dismissed or left alone

Keep response concise and actionable.`,
    context: {
      url,
    },
  });
}
