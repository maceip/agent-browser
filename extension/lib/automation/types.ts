/**
 * Core automation types for browser automation with speed/stealth modes
 */

// ============================================================================
// Execution Modes
// ============================================================================

export type ExecutionMode = 'speed' | 'stealth';

export interface SpeedModeConfig {
  parallelExecution: boolean;
  immediateTyping: boolean;
  skipAnimations: boolean;
  cacheAggressively: boolean;
  minDelay: number;
}

export interface StealthModeConfig {
  humanizeTiming: boolean;
  randomizeFingerprints: boolean;
  simulateBehavior: boolean;
  typingDelayRange: [number, number];
  mouseMoveDelay: number;
  interCommandDelay: number;
}

export interface ModeConfig {
  mode: ExecutionMode;
  speed: SpeedModeConfig;
  stealth: StealthModeConfig;
}

// ============================================================================
// Command Types
// ============================================================================

export type CommandAction =
  | 'click'
  | 'type'
  | 'scroll'
  | 'wait'
  | 'screenshot'
  | 'navigate'
  | 'get_element';

export interface Command {
  commandId: string;
  action: CommandAction;
  params: Record<string, any>;
  mode?: ExecutionMode;
  timestamp?: number;
}

export interface CommandResult {
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  mode: ExecutionMode;
  timestamp: number;
  retryCount?: number;
}

// ============================================================================
// Specific Command Parameters
// ============================================================================

export interface ClickParams {
  selector?: string;
  xpath?: string;
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
}

export interface TypeParams {
  selector?: string;
  xpath?: string;
  text: string;
  clear?: boolean;
  delay?: number;
}

export interface ScrollParams {
  x?: number;
  y?: number;
  selector?: string;
  behavior?: 'auto' | 'smooth';
}

export interface WaitParams {
  type: 'time' | 'selector' | 'navigation' | 'load';
  duration?: number;
  selector?: string;
  timeout?: number;
}

export interface ScreenshotParams {
  fullPage?: boolean;
  selector?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
}

// ============================================================================
// Command Handler Type
// ============================================================================

export type CommandHandler = (
  command: Command,
  config: ModeConfig
) => Promise<any>;

// ============================================================================
// Element Selector
// ============================================================================

export interface ElementSelector {
  selector?: string;
  xpath?: string;
}

export interface ElementInfo {
  found: boolean;
  selector: string;
  bounds?: DOMRect;
  visible?: boolean;
}
