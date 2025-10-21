/**
 * MCP Tool Handlers
 * Executes tool calls by dispatching to appropriate modules
 */

import { JsonRpcResponse } from './types';

export interface ToolCallParams {
  name: string;
  arguments: any;
}

/**
 * Handle a tool call
 *
 * @param params Tool call parameters
 * @param tabRouter Function to route messages to content script
 * @param screenshotHandler Function to capture screenshots
 * @param passkeyHandler Function to handle passkey operations
 * @param credentialStoreProxy Function to proxy requests to Rust server credential store
 * @returns Tool execution result
 */
export async function handleToolCall(
  params: ToolCallParams,
  tabRouter: (method: string, args: any) => Promise<any>,
  screenshotHandler: (args: any) => Promise<any>,
  passkeyHandler: (operation: string, args: any) => Promise<any>,
  credentialStoreProxy: (operation: string, args: any) => Promise<any>
): Promise<any> {
  const { name, arguments: args } = params;

  // Handle tools based on their type
  switch (name) {
    // Browser automation tools - route to content script
    case 'playwright_navigate':
      return await tabRouter('navigate', args);

    case 'playwright_click':
      return await tabRouter('click', args);

    case 'playwright_fill':
      // Map 'value' to 'text' for internal command
      const typeArgs = {
        selector: args.selector,
        text: args.value,
      };
      return await tabRouter('type', typeArgs);

    case 'playwright_detect_modal':
      return await tabRouter('detect_modal', args);

    case 'playwright_dismiss_modal':
      return await tabRouter('dismiss_modal', args);

    // Screenshot - handled in background
    case 'playwright_screenshot':
      return await screenshotHandler(args);

    // Passkey operations - handled in background via WebAuthn proxy
    case 'passkey_enable':
      return await passkeyHandler('enable', args);

    case 'passkey_status':
      return await passkeyHandler('status', args);

    case 'passkey_list':
      return await passkeyHandler('list', args);

    case 'passkey_clear':
      return await passkeyHandler('clear', args);

    // Credential store operations - proxy to Rust server
    case 'passkey_authorize':
      return await credentialStoreProxy('authorize', args);

    case 'passkey_authorization_status':
      return await credentialStoreProxy('authorization_status', args);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Format tool result for MCP response
 */
export function formatToolResult(result: any): any {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
