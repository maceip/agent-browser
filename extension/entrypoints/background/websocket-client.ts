/**
 * WebSocketClient - Manages WebSocket connection to Rust server
 */

import type { BadgeManager } from './badge-manager';
import type { McpServer } from '../../lib/mcp';
import type { CommandType, PendingRequest } from './types';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_BASE_DELAY = 1000;
  private pending = new Map<string, PendingRequest>();
  private mcpServer: McpServer | null = null;

  constructor(private badgeManager: BadgeManager) {}

  /**
   * Set MCP server instance
   */
  setMcpServer(mcpServer: McpServer): void {
    this.mcpServer = mcpServer;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WebSocketClient] Already connected');
      return;
    }

    console.log('[WebSocketClient] Connecting to WebSocket server...');
    this.ws = new WebSocket('ws://localhost:8085');

    this.ws.onopen = () => {
      console.log('[WebSocketClient] WebSocket connected');
      this.reconnectAttempts = 0;
      this.badgeManager.setState({
        serverStatus: 'connected',
        errorType: null,
        reconnectAttempt: 0,
        errorMessage: undefined,
      });
    };

    this.ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[WebSocketClient] Received message from server:', message);

        // Check if this is an MCP request forwarded from Rust server
        if (message.method === 'mcp_request' && message.params) {
          await this.handleMcpRequest(message);
        } else {
          // Legacy message format or other message types
          await this.handleLegacyRequest(message);
        }
      } catch (error) {
        this.handleError(error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocketClient] WebSocket error:', error);
      this.badgeManager.setState({
        serverStatus: 'error',
        errorMessage: 'WebSocket error',
      });
    };

    this.ws.onclose = () => {
      console.log('[WebSocketClient] WebSocket closed');
      this.badgeManager.setState({ serverStatus: 'disconnected' });
      this.ws = null;

      // Reject all pending requests
      for (const [id, request] of this.pending.entries()) {
        clearTimeout(request.timeout);
        request.reject(new Error('WebSocket disconnected'));
      }
      this.pending.clear();

      // Attempt reconnection
      this.scheduleReconnect();
    };
  }

  /**
   * Handle MCP request forwarded from Rust server
   */
  private async handleMcpRequest(message: any): Promise<void> {
    if (!this.mcpServer) {
      throw new Error('MCP server not initialized');
    }

    // This is a JSON-RPC request forwarded from the Rust server
    const mcpRequest = message.params;
    console.log('[WebSocketClient] Processing forwarded MCP request:', mcpRequest);

    // Set active command badge for known commands
    if (mcpRequest.method === 'tools/call' && mcpRequest.params?.name) {
      const toolName = mcpRequest.params.name;
      const commandMethod = toolName.replace('playwright_', '');
      if (['navigate', 'click', 'fill', 'screenshot'].includes(commandMethod)) {
        const badgeCommand = commandMethod === 'fill' ? 'type' : commandMethod;
        this.badgeManager.setState({ activeCommand: badgeCommand as CommandType });
      }
    }

    // Handle the MCP request
    const mcpResponse = await this.mcpServer.handleRequest(mcpRequest);

    // Clear active command badge
    this.badgeManager.setState({ activeCommand: null });

    // Send the MCP response back (wrapped in our protocol)
    const response = {
      id: message.id,
      success: true,
      result: mcpResponse,
    };

    this.send(response);
  }

  /**
   * Handle legacy message format (backward compatibility)
   */
  private async handleLegacyRequest(request: any): Promise<void> {
    if (!this.mcpServer) {
      throw new Error('MCP server not initialized');
    }

    // Set active command badge for known commands
    if (request.method && (
      request.method === 'navigate' ||
      request.method === 'click' ||
      request.method === 'type' ||
      request.method === 'wait' ||
      request.method === 'screenshot' ||
      request.method === 'tools/call'
    )) {
      // For tools/call, extract the actual tool name
      const commandMethod = request.method === 'tools/call'
        ? request.params?.name?.replace('playwright_', '') || null
        : request.method;

      if (commandMethod && ['navigate', 'click', 'type', 'screenshot'].includes(commandMethod)) {
        this.badgeManager.setState({ activeCommand: commandMethod as CommandType });
      }
    }

    // Handle request using MCP server
    const response = await this.mcpServer.handleRequest(request);

    // Clear active command badge
    this.badgeManager.setState({ activeCommand: null });

    // Send response back through WebSocket
    this.send(response);
  }

  /**
   * Handle errors during message processing
   */
  private handleError(error: unknown): void {
    console.error('[WebSocketClient] Error handling message:', error);
    this.badgeManager.setState({
      activeCommand: null,
      errorType: 'server_error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    // Clear error after 3 seconds
    setTimeout(() => {
      const currentState = this.badgeManager.getState();
      if (currentState.errorType === 'server_error') {
        this.badgeManager.setState({ errorType: null, errorMessage: undefined });
      }
    }, 3000);

    // Send error response
    const errorResponse = {
      id: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    this.send(errorResponse);
  }

  /**
   * Send message through WebSocket
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[WebSocketClient] Max reconnect attempts reached');
      this.badgeManager.setState({
        serverStatus: 'error',
        errorMessage: 'Max reconnect attempts reached',
      });
      return;
    }

    const delay = Math.min(
      this.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      30000
    );

    this.reconnectAttempts++;
    console.log(`[WebSocketClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.badgeManager.setState({
      serverStatus: 'reconnecting',
      reconnectAttempt: this.reconnectAttempts,
    });

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Ensure server is running via Native Messaging Host
   */
  async ensureServerRunning(): Promise<void> {
    console.log('[WebSocketClient] Calling NMH to ensure server is running...');
    this.badgeManager.setState({ serverStatus: 'starting' });

    try {
      const response = await chrome.runtime.sendNativeMessage(
        'com.agentbrowser.native',
        { cmd: 'ensure_server' }
      );

      console.log('[WebSocketClient] NMH response:', response);

      if (response.ok) {
        console.log('[WebSocketClient] Server is running');
        if (response.logs) {
          console.log('[WebSocketClient] Server logs:', response.logs);
        }
        // Give server a moment to fully start, then connect WebSocket
        setTimeout(() => this.connect(), 1000);
      } else {
        console.error('[WebSocketClient] NMH reported error:', response.error);
        this.badgeManager.setState({
          serverStatus: 'error',
          errorMessage: response.error || 'NMH reported error',
        });
        // Fall back to trying to connect anyway (maybe server is running)
        setTimeout(() => this.connect(), 2000);
      }
    } catch (error: any) {
      console.error('[WebSocketClient] Failed to call NMH:', error);
      console.log('[WebSocketClient] NMH may not be installed. Trying to connect to server anyway...');
      this.badgeManager.setState({
        serverStatus: 'error',
        errorMessage: 'NMH not responding',
      });
      // Fall back to connecting (maybe server is running manually)
      setTimeout(() => this.connect(), 2000);
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
