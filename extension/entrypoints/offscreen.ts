/**
 * Offscreen Document - LLM Inference Service
 *
 * Runs MediaPipe LLM inference in a Web Worker to prevent browser freeze
 * - Worker handles WASM compilation in separate thread
 * - OPFS caching for model persistence
 * - Streaming inference
 * - Communicates with background via chrome.runtime messaging
 */

// ============================================================================
// Types
// ============================================================================

interface LlmMessage {
  type: 'llm_init' | 'llm_query' | 'llm_stop' | 'generate';
  id?: string;
  prompt?: string;
  modelUrl?: string;
}

interface LlmResponse {
  type: 'llm_ready' | 'llm_chunk' | 'llm_complete' | 'llm_error' | 'llm_progress' | 'llm_response_chunk' | 'llm_response_complete';
  id?: string;
  text?: string;
  error?: string;
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  stage?: 'downloading' | 'initializing';
}

// ============================================================================
// State
// ============================================================================

const DEFAULT_MODEL_URL = 'https://storage.googleapis.com/ktex-static/gemma-3n-E2B-it-int4-Web.litertlm';

let worker: Worker | null = null;
let isInitialized = false;

// ============================================================================
// Worker Setup
// ============================================================================

function setupWorker(): void {
  if (worker) {
    console.log('[Offscreen] Worker already exists');
    return;
  }

  console.log('[Offscreen] Creating LLM Worker...');
  worker = new Worker('/llm-worker.js');

  worker.onmessage = (event) => {
    const message = event.data;
    console.log('[Offscreen] Worker message:', message.type);

    switch (message.type) {
      case 'ready':
        console.log('[Offscreen] ✅ Worker ready');
        if (message.message !== 'Worker is operational') {
          // Initial ready message, LLM is initialized
          isInitialized = true;
          sendToBackground({ type: 'llm_ready' });
        }
        break;

      case 'progress':
        sendToBackground({
          type: 'llm_progress',
          progress: message.progress || 0,
          downloadedBytes: message.downloadedBytes || 0,
          totalBytes: message.totalBytes || 0,
          stage: message.stage || 'downloading',
        });
        break;

      case 'chunk':
        // Forward streaming chunks to background
        chrome.runtime.sendMessage({
          type: 'llm_response_chunk',
          text: message.text,
        }).catch(() => {});

        if (message.done) {
          chrome.runtime.sendMessage({
            type: 'llm_response_complete',
          }).catch(() => {});
        }
        break;

      case 'error':
        console.error('[Offscreen] Worker error:', message.error);
        sendToBackground({
          type: 'llm_error',
          error: message.error,
        });
        break;
    }
  };

  worker.onerror = (error) => {
    console.error('[Offscreen] Worker error event:', error);
    sendToBackground({
      type: 'llm_error',
      error: 'Worker crashed: ' + error.message,
    });
  };

  console.log('[Offscreen] Worker created successfully');
}

// ============================================================================
// Initialization
// ============================================================================

async function initializeLlm(modelUrl: string = DEFAULT_MODEL_URL): Promise<void> {
  try {
    setupWorker();

    if (isInitialized) {
      console.log('[Offscreen] LLM already initialized');
      sendToBackground({ type: 'llm_ready' });
      return;
    }

    console.log('[Offscreen] Initializing LLM in Worker with model:', modelUrl);

    // Send init command to Worker
    worker!.postMessage({
      type: 'init',
      data: {
        modelUrl,
        maxTokens: 1024,
        topK: 40,
        temperature: 0.8,
      }
    });

    // Worker will send 'ready' message when initialization complete

  } catch (error) {
    console.error('[Offscreen] Failed to initialize LLM:', error);
    sendToBackground({
      type: 'llm_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// Inference
// ============================================================================

async function generateResponse(prompt: string): Promise<void> {
  if (!worker) {
    sendToBackground({
      type: 'llm_error',
      error: 'Worker not initialized',
    });
    return;
  }

  if (!isInitialized) {
    sendToBackground({
      type: 'llm_error',
      error: 'LLM not initialized',
    });
    return;
  }

  console.log('[Offscreen] Sending generation request to Worker:', prompt.substring(0, 50) + '...');

  // Send generate command to Worker
  // Worker will stream back chunks via onmessage handler
  worker.postMessage({
    type: 'generate',
    data: {
      prompt
    }
  });
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

    case 'generate':
      // Generate request from popup or background
      if (!message.prompt) {
        sendResponse({ success: false, error: 'Missing prompt' });
        return false;
      }

      generateResponse(message.prompt).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response

    case 'llm_stop':
      // LLM stop functionality
      // MediaPipe LLM Inference API does not currently support interrupting generation
      sendResponse({ success: false, error: 'Stop not supported by MediaPipe LLM API' });
      return false;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

// ============================================================================
// Web Worker Test
// ============================================================================

async function testWorker(): Promise<void> {
  console.log('[Offscreen] Testing Web Worker approach...');

  try {
    const worker = new Worker('/llm-worker.js');

    worker.onmessage = (event) => {
      console.log('[Offscreen] Worker message:', event.data);

      if (event.data.type === 'ready') {
        console.log('[Offscreen] ✅ Worker is ready, testing MediaPipe availability...');
        worker.postMessage({ type: 'check_mediapipe' });
      }

      if (event.data.type === 'mediapipe_check') {
        console.log('[Offscreen] MediaPipe availability:', event.data);

        // Send to background so it shows in service worker console
        chrome.runtime.sendMessage({
          type: 'worker_test_result',
          available: event.data.available,
          details: event.data
        });

        if (event.data.available) {
          console.log('[Offscreen] ✅ MediaPipe is available in Worker! We can proceed.');
        } else {
          console.error('[Offscreen] ❌ MediaPipe NOT available in Worker:', event.data.details);
        }
      }

      if (event.data.type === 'error') {
        console.error('[Offscreen] ❌ Worker error:', event.data.error);
      }
    };

    worker.onerror = (error) => {
      console.error('[Offscreen] ❌ Worker error event:', error);
    };

  } catch (error) {
    console.error('[Offscreen] ❌ Failed to create Worker:', error);
  }
}

// ============================================================================
// Initialization
// ============================================================================

console.log('[Offscreen] LLM service loaded (Worker-based)');

// Test Worker approach on first load (disabled - already confirmed working)
// testWorker();

// Setup the real Worker for LLM operations
setupWorker();

// Auto-initialize LLM on load (Worker prevents browser freeze)
console.log('[Offscreen] Auto-initializing LLM...');
initializeLlm().catch(err => {
  console.error('[Offscreen] Auto-init failed:', err);
});
