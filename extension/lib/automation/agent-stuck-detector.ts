/**
 * Agent Stuck Detector
 *
 * Detects when automation agents are stuck and should request LLM help
 */

import { askAutomationStuck, askElementNotFound, askModalHelp } from '../llm/query-service';

// ============================================================================
// Types
// ============================================================================

export interface StuckContext {
  command: string;
  error?: string;
  attempt: number;
  maxAttempts: number;
  selector?: string;
  url: string;
}

export interface StuckDetectionResult {
  isStuck: boolean;
  shouldAskLlm: boolean;
  shouldRetry: boolean;
  shouldGiveUp: boolean;
  reason?: string;
}

// ============================================================================
// Stuck Detection Logic
// ============================================================================

/**
 * Determine if agent is stuck and what to do about it
 */
export function detectStuck(context: StuckContext): StuckDetectionResult {
  const { attempt, maxAttempts, error, command } = context;

  // Not stuck if we haven't tried enough times
  if (attempt < 2) {
    return {
      isStuck: false,
      shouldAskLlm: false,
      shouldRetry: true,
      shouldGiveUp: false,
    };
  }

  // Stuck if we've tried multiple times
  if (attempt >= 3 && attempt < maxAttempts) {
    return {
      isStuck: true,
      shouldAskLlm: true, // Ask LLM for help after 3 attempts
      shouldRetry: true,
      shouldGiveUp: false,
      reason: `Failed ${attempt} times, asking LLM for help`,
    };
  }

  // Give up if we've exceeded max attempts
  if (attempt >= maxAttempts) {
    return {
      isStuck: true,
      shouldAskLlm: false,
      shouldRetry: false,
      shouldGiveUp: true,
      reason: `Failed ${attempt} times, giving up`,
    };
  }

  return {
    isStuck: false,
    shouldAskLlm: false,
    shouldRetry: true,
    shouldGiveUp: false,
  };
}

// ============================================================================
// LLM Help Requests
// ============================================================================

/**
 * Ask LLM for help when stuck
 */
export async function requestLlmHelp(context: StuckContext): Promise<string> {
  const { command, error, selector, url, attempt } = context;

  console.log('[Agent Stuck] Requesting LLM help:', {
    command,
    error: error?.substring(0, 100),
    attempt,
  });

  // Different helpers based on error type
  if (error?.includes('not found') || error?.includes('No element')) {
    if (selector) {
      return askElementNotFound(selector, url);
    }
  }

  if (error?.includes('modal') || error?.includes('Modal')) {
    return askModalHelp(url);
  }

  // Generic stuck help
  return askAutomationStuck(command, error || 'Unknown error', attempt, url);
}

// ============================================================================
// Retry Strategy with LLM Guidance
// ============================================================================

export interface RetryStrategy {
  shouldRetry: boolean;
  delay: number; // ms
  modifications?: {
    timeout?: number;
    selector?: string;
    strategy?: string;
  };
  llmSuggestion?: string;
}

/**
 * Determine retry strategy, optionally with LLM guidance
 */
export async function getRetryStrategy(
  context: StuckContext,
  useLlm: boolean = false
): Promise<RetryStrategy> {
  const detection = detectStuck(context);

  if (detection.shouldGiveUp) {
    return {
      shouldRetry: false,
      delay: 0,
    };
  }

  if (!detection.shouldRetry) {
    return {
      shouldRetry: false,
      delay: 0,
    };
  }

  // Base retry strategy: exponential backoff
  const delay = Math.min(1000 * Math.pow(2, context.attempt - 1), 5000);

  if (detection.shouldAskLlm && useLlm) {
    try {
      const llmResponse = await requestLlmHelp(context);

      return {
        shouldRetry: true,
        delay,
        llmSuggestion: llmResponse,
        modifications: parseLlmSuggestions(llmResponse),
      };
    } catch (error) {
      console.error('[Agent Stuck] LLM query failed:', error);
      // Fall back to basic retry
    }
  }

  return {
    shouldRetry: true,
    delay,
  };
}

/**
 * Parse LLM suggestions for actionable modifications
 */
function parseLlmSuggestions(llmResponse: string): RetryStrategy['modifications'] {
  const modifications: RetryStrategy['modifications'] = {};

  // Look for timeout suggestions
  const timeoutMatch = llmResponse.match(/timeout.*?(\d+)\s*(ms|milliseconds|seconds)/i);
  if (timeoutMatch) {
    const value = parseInt(timeoutMatch[1]);
    const unit = timeoutMatch[2].toLowerCase();
    modifications.timeout = unit.startsWith('s') ? value * 1000 : value;
  }

  // Look for selector suggestions
  const selectorMatch = llmResponse.match(/selector[:\s]+["']([^"']+)["']/i);
  if (selectorMatch) {
    modifications.selector = selectorMatch[1];
  }

  // Look for strategy suggestions
  if (llmResponse.match(/try.*?xpath/i)) {
    modifications.strategy = 'xpath';
  } else if (llmResponse.match(/try.*?css/i)) {
    modifications.strategy = 'css';
  }

  return modifications;
}

// ============================================================================
// Usage Example
// ============================================================================

/**
 * Example: Retry click command with LLM assistance
 */
export async function retryWithLlmHelp<T>(
  operation: () => Promise<T>,
  context: StuckContext
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= context.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      const updatedContext = {
        ...context,
        attempt,
        error: lastError.message,
      };

      const strategy = await getRetryStrategy(updatedContext, true);

      if (!strategy.shouldRetry) {
        throw lastError;
      }

      if (strategy.llmSuggestion) {
        console.log('[Agent Stuck] LLM suggestion:', strategy.llmSuggestion);

        // TODO: Apply modifications from LLM
        if (strategy.modifications) {
          console.log('[Agent Stuck] Applying modifications:', strategy.modifications);
        }
      }

      console.log(`[Agent Stuck] Retrying in ${strategy.delay}ms (attempt ${attempt + 1}/${context.maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, strategy.delay));
    }
  }

  throw lastError || new Error('Operation failed after max attempts');
}
