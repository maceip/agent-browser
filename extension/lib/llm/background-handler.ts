/**
 * LLM Background Handler
 *
 * Handles LLM query requests from content scripts and routes to offscreen document
 */

// ============================================================================
// Types
// ============================================================================

interface LlmQuery {
  id: string;
  prompt: string;
  resolve: (response: string) => void;
  reject: (error: Error) => void;
  chunks: string[];
}

// ============================================================================
// State
// ============================================================================

const activeLlmQueries = new Map<string, LlmQuery>();
let offscreenReady = false;

// ============================================================================
// Public API
// ============================================================================

export function setOffscreenReady(ready: boolean): void {
  offscreenReady = ready;
}

export async function handleLlmQueryRequest(message: any): Promise<string> {
  if (!offscreenReady) {
    throw new Error('LLM not ready - still downloading model');
  }

  const queryId = message.id || `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const prompt = message.prompt;

  console.log('[Background LLM] Query request:', prompt.substring(0, 100));

  return new Promise((resolve, reject) => {
    activeLlmQueries.set(queryId, {
      id: queryId,
      prompt,
      resolve,
      reject,
      chunks: [],
    });

    // Send to offscreen document
    chrome.runtime.sendMessage({
      type: 'llm_query',
      id: queryId,
      prompt,
    }).catch(error => {
      activeLlmQueries.delete(queryId);
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (activeLlmQueries.has(queryId)) {
        activeLlmQueries.delete(queryId);
        reject(new Error('LLM query timeout'));
      }
    }, 30000);
  });
}

export function handleLlmChunk(id: string, text: string, ws?: WebSocket): void {
  // Handle streaming chunks for active queries
  if (id && activeLlmQueries.has(id)) {
    const query = activeLlmQueries.get(id)!;
    query.chunks.push(text || '');
  }

  // Forward to WebSocket if needed (for Rust server streaming)
  if (ws && ws.readyState === WebSocket.OPEN && id?.startsWith('rust_')) {
    ws.send(JSON.stringify({
      type: 'llm_chunk',
      id,
      text
    }));
  }

  console.log('[Background LLM] Chunk:', text?.substring(0, 50));
}

export function handleLlmComplete(id: string): void {
  // Resolve pending query if exists
  if (id && activeLlmQueries.has(id)) {
    const query = activeLlmQueries.get(id)!;
    const fullResponse = query.chunks.join('');
    query.resolve(fullResponse);
    activeLlmQueries.delete(id);
  }

  console.log('[Background LLM] Generation complete');
}

export function handleLlmError(id: string, error: string): void {
  // Reject pending query if exists
  if (id && activeLlmQueries.has(id)) {
    const query = activeLlmQueries.get(id)!;
    query.reject(new Error(error || 'LLM generation failed'));
    activeLlmQueries.delete(id);
  }

  console.error('[Background LLM] Error:', error);
}
