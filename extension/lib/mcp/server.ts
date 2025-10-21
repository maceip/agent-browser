/**
 * MCP Server Implementation
 * Handles JSON-RPC 2.0 protocol for Model Context Protocol
 */

import { JsonRpcRequest, JsonRpcResponse, McpInitializeResult } from './types';
import { MCP_TOOLS } from './tools';
import { handleToolCall, formatToolResult } from './handlers';

export class McpServer {
  private tabRouter: (method: string, args: any) => Promise<any>;
  private screenshotHandler: (args: any) => Promise<any>;
  private passkeyHandler: (operation: string, args: any) => Promise<any>;
  private credentialStoreProxy: (operation: string, args: any) => Promise<any>;

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
  private handleToolsList(request: JsonRpcRequest): JsonRpcResponse {
    return this.createSuccessResponse(request.id, {
      tools: MCP_TOOLS,
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
