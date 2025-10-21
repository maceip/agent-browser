/**
 * Shared types for background service
 */

export interface Message {
  id: string;
  method: string;
  params: Record<string, any>;
}

export interface Response {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

export interface PendingRequest {
  resolve: (value: Response) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// Badge state types
export type ServerStatus = 'starting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
export type CommandType = 'navigate' | 'click' | 'type' | 'wait' | 'screenshot' | null;
export type ErrorType = 'timeout' | 'injection_failed' | 'server_error' | null;
export type LlmStatus = 'idle' | 'downloading' | 'initializing' | 'ready' | 'generating' | 'error';
export type EmailStatus = 'not_configured' | 'configured' | 'active';
export type MagicLinkStatus = 'idle' | 'detected' | 'checking_inbox' | 'found' | 'clicking';

export interface BadgeState {
  serverStatus: ServerStatus;
  activeCommand: CommandType;
  errorType: ErrorType;
  reconnectAttempt: number;
  errorMessage?: string;
  llmStatus: LlmStatus;
  llmProgress: number; // 0-1
  llmDownloadedBytes: number;
  llmTotalBytes: number;
  emailStatus: EmailStatus;
  emailAddress?: string;
  emailProvider?: string;
  magicLinkStatus: MagicLinkStatus;
  magicLinkDomain?: string;
}
