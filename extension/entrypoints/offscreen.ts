/**
 * Offscreen Document - LLM Inference Service
 *
 * Runs MediaPipe LLM inference in an isolated context
 * - Downloads and caches Gemma model (3.8GB)
 * - Handles streaming inference
 * - Communicates with background via chrome.runtime messaging
 */

import { FilesetResolver, LlmInference } from '@mediapipe/tasks-genai';

// ============================================================================
// Types
// ============================================================================

interface LlmMessage {
  type: 'llm_init' | 'llm_query' | 'llm_stop';
  id?: string;
  prompt?: string;
  modelUrl?: string;
}

interface LlmResponse {
  type: 'llm_ready' | 'llm_chunk' | 'llm_complete' | 'llm_error' | 'llm_progress';
  id?: string;
  text?: string;
  error?: string;
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
}

// ============================================================================
// State
// ============================================================================

let llmInference: LlmInference | null = null;
let isInitializing = false;

const DEFAULT_MODEL_URL = 'https://huggingface.co/google/gemma-3n-E2B-it-litert-lm/resolve/main/gemma-3n-E2B-it-int4-Web.litertlm';

// ============================================================================
// Model Loading with Progress Tracking
// ============================================================================

async function initializeLlm(modelUrl: string = DEFAULT_MODEL_URL): Promise<void> {
  if (llmInference) {
    console.log('[Offscreen] LLM already initialized');
    sendToBackground({ type: 'llm_ready' });
    return;
  }

  if (isInitializing) {
    console.log('[Offscreen] LLM already initializing');
    return;
  }

  isInitializing = true;
  console.log('[Offscreen] Initializing LLM with model:', modelUrl);

  try {
    // Resolve GenAI fileset - using CDN for WASM files
    const genaiFileset = await FilesetResolver.forGenAiTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.25/wasm'
    );

    // Fetch model with progress tracking
    console.log('[Offscreen] Fetching model...');
    const response = await fetch(modelUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch model: ${response.statusText}`);
    }

    const contentLength = parseInt(response.headers.get('Content-Length') || '0');
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    let downloadedBytes = 0;
    const chunks: Uint8Array[] = [];

    // Read stream with progress updates
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      downloadedBytes += value.length;

      const progress = contentLength > 0 ? downloadedBytes / contentLength : 0;

      // Send progress updates
      sendToBackground({
        type: 'llm_progress',
        progress,
        downloadedBytes,
        totalBytes: contentLength,
      });
    }

    // Combine chunks into single buffer
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const modelBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      modelBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    console.log('[Offscreen] Model downloaded, creating LLM instance...');

    // Create LLM inference instance
    llmInference = await LlmInference.createFromOptions(genaiFileset, {
      baseOptions: {
        modelAssetBuffer: new ReadableStream({
          start(controller) {
            controller.enqueue(modelBuffer);
            controller.close();
          }
        }).getReader(),
      },
      maxTokens: 1024,
      topK: 40,
      temperature: 0.8,
    });

    console.log('[Offscreen] LLM initialized successfully');
    sendToBackground({ type: 'llm_ready' });

  } catch (error) {
    console.error('[Offscreen] Failed to initialize LLM:', error);
    sendToBackground({
      type: 'llm_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    isInitializing = false;
  }
}

// ============================================================================
// Inference
// ============================================================================

async function generateResponse(id: string, prompt: string): Promise<void> {
  if (!llmInference) {
    sendToBackground({
      type: 'llm_error',
      id,
      error: 'LLM not initialized',
    });
    return;
  }

  console.log('[Offscreen] Generating response for:', prompt.substring(0, 50) + '...');

  try {
    llmInference.generateResponse(prompt, (partialResult: string, done: boolean) => {
      sendToBackground({
        type: 'llm_chunk',
        id,
        text: partialResult,
      });

      if (done) {
        sendToBackground({
          type: 'llm_complete',
          id,
        });
      }
    });
  } catch (error) {
    console.error('[Offscreen] Generation error:', error);
    sendToBackground({
      type: 'llm_error',
      id,
      error: error instanceof Error ? error.message : 'Generation failed',
    });
  }
}

// ============================================================================
// Message Handling
// ============================================================================

function sendToBackground(message: LlmResponse): void {
  chrome.runtime.sendMessage(message).catch((error) => {
    console.error('[Offscreen] Failed to send message to background:', error);
  });
}

chrome.runtime.onMessage.addListener((message: LlmMessage, sender, sendResponse) => {
  console.log('[Offscreen] Received message:', message.type);

  switch (message.type) {
    case 'llm_init':
      initializeLlm(message.modelUrl).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response

    case 'llm_query':
      if (!message.id || !message.prompt) {
        sendResponse({ success: false, error: 'Missing id or prompt' });
        return false;
      }
      generateResponse(message.id, message.prompt).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response

    case 'llm_stop':
      // TODO: Implement stop functionality if MediaPipe supports it
      sendResponse({ success: false, error: 'Stop not yet implemented' });
      return false;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

// ============================================================================
// Initialization
// ============================================================================

console.log('[Offscreen] LLM service loaded');
