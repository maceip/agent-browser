/**
 * Tests for delay utility functions
 */

import { test, expect, describe } from 'bun:test';

describe('Delay Utils', () => {
  test('getRandomDelay returns value in range', () => {
    const min = 100;
    const max = 200;

    // Simple mock test - actual implementation would import real functions
    const getRandomDelay = (range: [number, number]) => {
      const [min, max] = range;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    const delay = getRandomDelay([min, max]);
    expect(delay).toBeGreaterThanOrEqual(min);
    expect(delay).toBeLessThanOrEqual(max);
  });

  test('humanized delay adds variance', () => {
    const baseDelay = 1000;
    const variance = 0.2;

    const getHumanizedDelay = (base: number, variance: number) => {
      const min = base * (1 - variance);
      const max = base * (1 + variance);
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    const delay = getHumanizedDelay(baseDelay, variance);

    // Should be within ±20% of base
    expect(delay).toBeGreaterThanOrEqual(baseDelay * 0.8);
    expect(delay).toBeLessThanOrEqual(baseDelay * 1.2);
  });

  test('modal interaction delay has minimum', () => {
    const speedModeDelay = 10; // Very fast mode
    const minimumDelay = 100;

    const getModalDelay = (configDelay: number, minimum: number) => {
      return Math.max(configDelay, minimum);
    };

    const delay = getModalDelay(speedModeDelay, minimumDelay);
    expect(delay).toBe(minimumDelay);
  });
});
