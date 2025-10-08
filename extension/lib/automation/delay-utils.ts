/**
 * Delay Utilities with Smooth Timing
 *
 * Provides humanized and mode-aware delays for automation actions
 */

import type { ModeConfig } from './types';

// ============================================================================
// Random Delay Generation
// ============================================================================

/**
 * Generate random delay within range (similar to webtrans)
 */
export function getRandomDelay(range: [number, number]): number {
  const [min, max] = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate humanized delay with variance
 * Adds natural variation to avoid detection patterns
 */
export function getHumanizedDelay(baseDelay: number, variance = 0.2): number {
  const min = baseDelay * (1 - variance);
  const max = baseDelay * (1 + variance);
  return getRandomDelay([Math.floor(min), Math.ceil(max)]);
}

// ============================================================================
// Mode-Aware Delays
// ============================================================================

/**
 * Apply mode-specific delay before action
 */
export async function applyModeDelay(config: ModeConfig): Promise<void> {
  if (config.mode === 'stealth' && config.stealth.interCommandDelay > 0) {
    const delay = config.stealth.humanizeTiming
      ? getHumanizedDelay(config.stealth.interCommandDelay, 0.2)
      : config.stealth.interCommandDelay;
    await sleep(delay);
  } else if (config.speed.minDelay > 0) {
    await sleep(config.speed.minDelay);
  }
}

/**
 * Get typing delay for a character based on mode
 */
export function getTypingDelay(config: ModeConfig): number {
  if (config.mode === 'stealth') {
    return config.stealth.humanizeTiming
      ? getRandomDelay(config.stealth.typingDelayRange)
      : config.stealth.typingDelayRange[0];
  }
  return 0;
}

/**
 * Get mouse move delay based on mode
 */
export function getMouseMoveDelay(config: ModeConfig): number {
  if (config.mode === 'stealth') {
    return config.stealth.humanizeTiming
      ? getHumanizedDelay(config.stealth.mouseMoveDelay, 0.15)
      : config.stealth.mouseMoveDelay;
  }
  return config.speed.minDelay;
}

/**
 * Get modal interaction delay based on mode
 * Modals need careful timing to ensure dismissal works
 */
export function getModalInteractionDelay(config: ModeConfig): number {
  if (config.mode === 'stealth') {
    // Modal interactions need a bit more delay for realism
    return getHumanizedDelay(config.stealth.mouseMoveDelay * 1.5, 0.2);
  }
  // Even in speed mode, give modals a tiny delay to settle
  return Math.max(config.speed.minDelay, 100);
}

// ============================================================================
// Sleep Utilities
// ============================================================================

/**
 * Basic sleep function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sleep with humanized variance
 */
export async function sleepHumanized(baseMs: number, variance = 0.2): Promise<void> {
  const delay = getHumanizedDelay(baseMs, variance);
  await sleep(delay);
}

// ============================================================================
// Adaptive Delays
// ============================================================================

/**
 * Adaptive delay based on action complexity
 * More complex actions get longer delays in stealth mode
 */
export function getAdaptiveDelay(
  config: ModeConfig,
  complexity: 'simple' | 'medium' | 'complex'
): number {
  if (config.mode !== 'stealth') {
    return config.speed.minDelay;
  }

  const baseDelay = config.stealth.interCommandDelay;
  const multipliers = {
    simple: 1.0,
    medium: 1.5,
    complex: 2.0,
  };

  const delay = baseDelay * multipliers[complexity];
  return config.stealth.humanizeTiming
    ? getHumanizedDelay(delay, 0.2)
    : delay;
}

/**
 * Progressive delay for repeated actions
 * Adds slight increase to each subsequent action to appear more human
 */
export function getProgressiveDelay(
  config: ModeConfig,
  iteration: number,
  maxIterations: number
): number {
  if (config.mode !== 'stealth' || !config.stealth.humanizeTiming) {
    return config.mode === 'stealth'
      ? config.stealth.interCommandDelay
      : config.speed.minDelay;
  }

  // Add 5-10% more delay with each iteration
  const baseDelay = config.stealth.interCommandDelay;
  const progress = iteration / Math.max(maxIterations, 1);
  const progressMultiplier = 1 + (progress * 0.15); // Up to 15% slower

  return getHumanizedDelay(baseDelay * progressMultiplier, 0.2);
}
