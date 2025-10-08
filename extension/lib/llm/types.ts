/**
 * Type definitions for LLM service
 * Adapted from MediaPipe LiteRT demo
 */

export interface Template {
  pre: string;
  post: string;
}

export type PromptTemplate = Record<ChatMessage['role'], Template>;

export type Tool = (text: string) => Promise<string>;

export interface Persona {
  name: string;
  // Instructions and few shot examples for the persona. Always included in the
  // prompt.
  instructions: ChatMessage[];
  // TODO: Model-agnostic
  promptTemplate?: PromptTemplate;
  tools?: Record<string /* line to match */, Tool>;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string; // Contains the full response or the response so far.
  templateApplied?: {
    text: string;
    tokenCount: number;
  };
  latencyMilliseconds?: number;
  // Different from templateApplied.tokenCount, which includes the template
  // tokens as well.
  generatedTokenCount?: number;
  doneGenerating?: boolean;
}
