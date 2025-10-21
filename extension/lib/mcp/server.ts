/**
 * MCP Server Implementation
 * Handles JSON-RPC 2.0 protocol for Model Context Protocol
 */

import { JsonRpcRequest, JsonRpcResponse, McpInitializeResult, McpTool } from './types';
import { MCP_TOOLS } from './tools';
import { handleToolCall, formatToolResult } from './handlers';
import type { PageTracker } from '../../entrypoints/background/page-tracker';
import { tldToToolName, toolNameToTLD } from '../utils/tld-extractor';

export class McpServer {
  private tabRouter: (method: string, args: any) => Promise<any>;
  private screenshotHandler: (args: any) => Promise<any>;
  private passkeyHandler: (operation: string, args: any) => Promise<any>;
  private credentialStoreProxy: (operation: string, args: any) => Promise<any>;
  private pageTracker: PageTracker | null = null;

  constructor(
    tabRouter: (method: string, args: any) => Promise<any>,
    screenshotHandler: (args: any) => Promise<any>,
    passkeyHandler: (operation: string, args: any) => Promise<any>,
    credentialStoreProxy: (operation: string, args: any) => Promise<any>
  ) {
    this.tabRouter = tabRouter;
    this.screenshotHandler = screenshotHandler;
    this.passkeyHandler = passkeyHandler;
    this.credentialStoreProxy = credentialStoreProxy;
  }

  /**
   * Set the page tracker for dynamic tool generation
   */
  setPageTracker(pageTracker: PageTracker): void {
    this.pageTracker = pageTracker;
    console.log('[McpServer] Page tracker registered for dynamic tools');
  }

  /**
   * Handle an incoming MCP request
   */
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    console.log('[McpServer] Handling request:', request.method);

    try {
      switch (request.method) {
        case 'ping':
          return this.createSuccessResponse(request.id, { ok: true });

        case 'initialize':
          return this.handleInitialize(request);

        case 'tools/list':
          return this.handleToolsList(request);

        case 'tools/call':
          return await this.handleToolsCall(request);

        default:
          // Unknown method - try to forward to tab router as fallback
          const params = request.params || {};
          const result = await this.tabRouter(request.method, params);
          return this.createSuccessResponse(request.id, result);
      }
    } catch (error: any) {
      console.error('[McpServer] Error handling request:', error);
      return this.createErrorResponse(
        request.id,
        -32000,
        error.message || 'Internal error',
        error.stack
      );
    }
  }

  /**
   * Handle initialize request
   */
  private handleInitialize(request: JsonRpcRequest): JsonRpcResponse {
    const result: McpInitializeResult = {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: 'agent-browser',
        version: '0.1.0',
      },
    };

    return this.createSuccessResponse(request.id, result);
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    // Start with static tools
    const allTools: McpTool[] = [...MCP_TOOLS];

    // Add dynamic page tools if page tracker is available
    if (this.pageTracker) {
      try {
        const pages = await this.pageTracker.getAllPages();

        for (const page of pages) {
          const toolName = tldToToolName(page.domain);
          const actions = await this.pageTracker.getPageActions(page.id!);

          // Create dynamic tool for this page
          const pageTool: McpTool = {
            name: toolName,
            description: `Interact with ${page.domain} (visited ${page.visit_count} times)`,
            inputSchema: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  description: 'The action to perform',
                  enum: actions.length > 0
                    ? actions.map(a => a.action_name)
                    : ['visit', 'get_info'],
                },
                parameters: {
                  type: 'object',
                  description: 'Action-specific parameters',
                },
              },
              required: ['action'],
            },
          };

          allTools.push(pageTool);
        }

        console.log(`[McpServer] Generated ${pages.length} dynamic page tools`);
      } catch (error) {
        console.error('[McpServer] Error generating dynamic tools:', error);
      }
    }

    return this.createSuccessResponse(request.id, {
      tools: allTools,
    });
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const params = request.params || {};
    const toolName = params.name;
    const toolArguments = params.arguments || {};

    if (!toolName) {
      return this.createErrorResponse(
        request.id,
        -32602,
        'Missing tool name',
        null
      );
    }

    try {
      // Check if this is a dynamic page tool (starts with "page_")
      if (toolName.startsWith('page_')) {
        return await this.handleDynamicPageTool(request.id, toolName, toolArguments);
      }

      // Handle static tools
      const result = await handleToolCall(
        { name: toolName, arguments: toolArguments },
        this.tabRouter,
        this.screenshotHandler,
        this.passkeyHandler,
        this.credentialStoreProxy
      );

      const formattedResult = formatToolResult(result);
      return this.createSuccessResponse(request.id, formattedResult);
    } catch (error: any) {
      return this.createErrorResponse(
        request.id,
        -32000,
        error.message || 'Tool execution failed',
        error.stack
      );
    }
  }

  /**
   * Handle dynamic page tool calls
   */
  private async handleDynamicPageTool(
    requestId: string | number | null,
    toolName: string,
    toolArguments: any
  ): Promise<JsonRpcResponse> {
    if (!this.pageTracker) {
      return this.createErrorResponse(
        requestId,
        -32000,
        'Page tracker not initialized',
        null
      );
    }

    const domain = toolNameToTLD(toolName);
    if (!domain) {
      return this.createErrorResponse(
        requestId,
        -32602,
        `Invalid page tool name: ${toolName}`,
        null
      );
    }

    const action = toolArguments.action;
    if (!action) {
      return this.createErrorResponse(
        requestId,
        -32602,
        'Missing action parameter',
        null
      );
    }

    // Get page and actions from database
    const page = await this.pageTracker.getPageByDomain(domain);
    if (!page || !page.id) {
      return this.createErrorResponse(
        requestId,
        -32000,
        `Page not found: ${domain}`,
        null
      );
    }

    const actions = await this.pageTracker.getPageActions(page.id);
    const actionDef = actions.find(a => a.action_name === action);

    // Handle built-in actions
    if (action === 'visit') {
      // Navigate to the page
      const result = await this.tabRouter('navigate', { url: `https://${domain}` });
      const formattedResult = formatToolResult({
        success: true,
        action: 'visit',
        domain,
        result,
      });
      return this.createSuccessResponse(requestId, formattedResult);
    }

    if (action === 'get_info') {
      // Return page information
      const formattedResult = formatToolResult({
        domain,
        visits: page.visit_count,
        first_visited: new Date(page.first_visited).toISOString(),
        last_visited: new Date(page.last_visited).toISOString(),
        available_actions: actions.map(a => a.action_name),
      });
      return this.createSuccessResponse(requestId, formattedResult);
    }

    // Handle custom actions
    if (actionDef) {
      const actionParams = toolArguments.parameters || {};

      // Execute the action based on its type
      let result;
      switch (actionDef.action_type) {
        case 'click':
          if (!actionDef.selector) {
            throw new Error('Action missing selector');
          }
          result = await this.tabRouter('click', { selector: actionDef.selector });
          break;

        case 'fill':
          if (!actionDef.selector) {
            throw new Error('Action missing selector');
          }
          if (!actionParams.value) {
            throw new Error('Fill action requires value parameter');
          }
          result = await this.tabRouter('type', {
            selector: actionDef.selector,
            text: actionParams.value,
          });
          break;

        case 'navigate':
          const url = actionParams.url || `https://${domain}`;
          result = await this.tabRouter('navigate', { url });
          break;

        default:
          throw new Error(`Unknown action type: ${actionDef.action_type}`);
      }

      const formattedResult = formatToolResult({
        success: true,
        action: action,
        domain,
        result,
      });
      return this.createSuccessResponse(requestId, formattedResult);
    }

    // Action not found
    return this.createErrorResponse(
      requestId,
      -32000,
      `Unknown action: ${action} for ${domain}`,
      { available_actions: actions.map(a => a.action_name) }
    );
  }

  /**
   * Create a success response
   */
  private createSuccessResponse(id: string | number | null, result: any): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  /**
   * Create an error response
   */
  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data: any
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data,
      },
    };
  }
}
