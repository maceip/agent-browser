/**
 * Mode configurations for speed and stealth execution modes
 */

import type { ModeConfig, ExecutionMode } from './types';

// ============================================================================
// Speed Mode Configuration
// ============================================================================

export const SPEED_MODE: ModeConfig = {
  mode: 'speed',
  speed: {
    parallelExecution: true,
    immediateTyping: true,
    skipAnimations: true,
    cacheAggressively: true,
    minDelay: 0,
  },
  stealth: {
    humanizeTiming: false,
    randomizeFingerprints: false,
    simulateBehavior: false,
    typingDelayRange: [0, 0],
    mouseMoveDelay: 0,
    interCommandDelay: 0,
  },
};

// ============================================================================
// Stealth Mode Configuration
// ============================================================================

export const STEALTH_MODE: ModeConfig = {
  mode: 'stealth',
  speed: {
    parallelExecution: false,
    immediateTyping: false,
    skipAnimations: false,
    cacheAggressively: false,
    minDelay: 50,
  },
  stealth: {
    humanizeTiming: true,
    randomizeFingerprints: true,
    simulateBehavior: true,
    typingDelayRange: [80, 150],
    mouseMoveDelay: 100,
    interCommandDelay: 300,
  },
};

// ============================================================================
// Mode Resolver
// ============================================================================

export function getModeConfig(mode?: ExecutionMode): ModeConfig {
  if (mode === 'stealth') {
    return STEALTH_MODE;
  }
  return SPEED_MODE;
}

export function createCustomConfig(
  baseMode: ExecutionMode,
  overrides: Partial<ModeConfig>
): ModeConfig {
  const base = getModeConfig(baseMode);
  return {
    ...base,
    ...overrides,
    speed: {
      ...base.speed,
      ...(overrides.speed || {}),
    },
    stealth: {
      ...base.stealth,
      ...(overrides.stealth || {}),
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate random delay within range for stealth mode
 */
export function getRandomDelay(range: [number, number]): number {
  const [min, max] = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Apply mode-specific delay before action
 */
export async function applyModeDelay(config: ModeConfig): Promise<void> {
  if (config.mode === 'stealth' && config.stealth.interCommandDelay > 0) {
    const delay = config.stealth.humanizeTiming
      ? getRandomDelay([
          config.stealth.interCommandDelay * 0.8,
          config.stealth.interCommandDelay * 1.2,
        ])
      : config.stealth.interCommandDelay;
    await new Promise((resolve) => setTimeout(resolve, delay));
  } else if (config.speed.minDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, config.speed.minDelay));
  }
}
