/**
 * LLM Web Worker - Runs MediaPipe LLM inference in separate thread
 * This prevents browser freeze during WASM compilation
 */

/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope;

console.log('[LLM Worker] Starting...');

// Import MediaPipe types
import type { FilesetResolver, LlmInference } from '@mediapipe/tasks-genai';

// Worker state
let llmInference: LlmInference | null = null;
let isInitialized = false;

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  console.log('[LLM Worker] Received message:', type);

  try {
    switch (type) {
      case 'test':
        // Test if Worker context is working
        self.postMessage({
          type: 'test_response',
          success: true,
          message: 'Worker is operational'
        });
        break;

      case 'check_mediapipe':
        // Check if we can dynamically import MediaPipe
        try {
          const { FilesetResolver, LlmInference } = await import('@mediapipe/tasks-genai');

          self.postMessage({
            type: 'mediapipe_check',
            available: true,
            details: {
              FilesetResolver: !!FilesetResolver,
              LlmInference: !!LlmInference,
              wasmSupport: typeof WebAssembly !== 'undefined'
            }
          });
        } catch (error) {
          self.postMessage({
            type: 'mediapipe_check',
            available: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        break;

      case 'init':
        // Initialize LLM
        await initializeLlm(data);
        break;

      case 'generate':
        // Generate response
        if (!llmInference) {
          throw new Error('LLM not initialized');
        }
        await generateResponse(data.prompt);
        break;

      default:
        console.warn('[LLM Worker] Unknown message type:', type);
    }
  } catch (error) {
    console.error('[LLM Worker] Error handling message:', error);
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

async function initializeLlm(config: any): Promise<void> {
  console.log('[LLM Worker] Initializing LLM...');

  try {
    const { FilesetResolver, LlmInference } = await import('@mediapipe/tasks-genai');

    // Stage 1: Load WASM runtime (0-33%) - Purple badge ▱▱▱ → ▰▱▱
    self.postMessage({
      type: 'progress',
      stage: 'downloading',
      progress: 0.1,
      downloadedBytes: 10,
      totalBytes: 100,
      message: 'Loading WASM runtime...'
    });

    const genaiFileset = await FilesetResolver.forGenAiTasks(
      self.location.origin + '/wasm'
    );

    self.postMessage({
      type: 'progress',
      stage: 'downloading',
      progress: 0.33,
      downloadedBytes: 33,
      totalBytes: 100,
      message: 'WASM runtime loaded'
    });

    // Stage 2: Load model from network/OPFS (33-67%) - Purple badge ▰▱▱ → ▰▰▱
    const modelUrl = config.modelUrl || 'https://storage.googleapis.com/ktex-static/gemma-3n-E2B-it-int4-Web.litertlm';

    self.postMessage({
      type: 'progress',
      stage: 'downloading',
      progress: 0.5,
      downloadedBytes: 50,
      totalBytes: 100,
      message: 'Loading model from cache/network...'
    });

    self.postMessage({
      type: 'progress',
      stage: 'downloading',
      progress: 0.67,
      downloadedBytes: 67,
      totalBytes: 100,
      message: 'Model files loaded'
    });

    // Stage 3: Create LLM instance (67-100%) - Purple badge ▰▰▱ → ▰▰▰
    self.postMessage({
      type: 'progress',
      stage: 'downloading',
      progress: 0.85,
      downloadedBytes: 85,
      totalBytes: 100,
      message: 'Creating model instance...'
    });

    self.postMessage({
      type: 'progress',
      stage: 'downloading',
      progress: 1.0,
      downloadedBytes: 100,
      totalBytes: 100,
      message: 'Model ready for initialization'
    });

    // Stage 4: Initialize (0-33%) - Yellow badge ▱▱▱ → ▰▱▱
    self.postMessage({
      type: 'progress',
      stage: 'initializing',
      progress: 0.1,
      downloadedBytes: 10,
      totalBytes: 100,
      message: 'Initializing GPU backend...'
    });

    self.postMessage({
      type: 'progress',
      stage: 'initializing',
      progress: 0.33,
      downloadedBytes: 33,
      totalBytes: 100,
      message: 'Compiling shaders...'
    });

    // Stage 5: Compile WASM (33-67%) - Yellow badge ▰▱▱ → ▰▰▱ (this is the long step)
    self.postMessage({
      type: 'progress',
      stage: 'initializing',
      progress: 0.5,
      downloadedBytes: 50,
      totalBytes: 100,
      message: 'Compiling WASM (this takes 10-15s)...'
    });

    // This is the actual long-running WASM compilation
    llmInference = await LlmInference.createFromOptions(genaiFileset, {
      baseOptions: {
        modelAssetPath: modelUrl
      },
      maxTokens: config.maxTokens || 1024,
      topK: config.topK || 40,
      temperature: config.temperature || 0.8,
    });

    // Stage 6: Finalize (67-100%) - Yellow badge ▰▰▱ → ▰▰▰
    self.postMessage({
      type: 'progress',
      stage: 'initializing',
      progress: 0.67,
      downloadedBytes: 67,
      totalBytes: 100,
      message: 'WASM compiled, warming up...'
    });

    self.postMessage({
      type: 'progress',
      stage: 'initializing',
      progress: 0.9,
      downloadedBytes: 90,
      totalBytes: 100,
      message: 'Finalizing...'
    });

    isInitialized = true;

    self.postMessage({
      type: 'ready',
      message: 'LLM initialized successfully'
    });

    console.log('[LLM Worker] ✅ LLM initialized successfully');
  } catch (error) {
    console.error('[LLM Worker] Initialization failed:', error);
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function generateResponse(prompt: string): Promise<void> {
  if (!llmInference) {
    throw new Error('LLM not initialized');
  }

  console.log('[LLM Worker] Generating response...');

  llmInference.generateResponse(prompt, (partialResult, done) => {
    self.postMessage({
      type: 'chunk',
      text: partialResult,
      done
    });

    if (done) {
      console.log('[LLM Worker] ✅ Generation complete');
    }
  });
}

console.log('[LLM Worker] Script loaded');
// Don't send ready message here - only send it after actual LLM initialization
