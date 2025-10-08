/*!
 * Agent Browser Server
 *
 * THREE INTERFACES (all run simultaneously):
 * 1. MCP TCP on localhost:8084 - MCP client connects here
 * 2. MCP stdio (optional) - Read from stdin, write to stdout
 * 3. WebSocket on localhost:8085 - Extension connects here
 *
 * Flow: MCP client → server → extension via WebSocket → response back
 */

use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, RwLock};
use tokio::time::{timeout, Duration};
use tokio_tungstenite::{accept_async, tungstenite::Message as WsMessage};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

mod mcp;
use mcp::{JsonRpcReq, JsonRpcRes};

mod credential_store;
use credential_store::CredentialStore;

// ============================================================================
// Message Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExtensionCommand {
    id: String,
    method: String,
    params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExtensionResponse {
    id: String,
    success: bool,
    result: Option<serde_json::Value>,
    error: Option<String>,
}

// ============================================================================
// Server State
// ============================================================================

type RequestId = String;

struct PendingRequest {
    tx: mpsc::Sender<ExtensionResponse>,
}

struct ServerState {
    // Map of request ID → response channel
    pending_requests: Arc<RwLock<HashMap<RequestId, PendingRequest>>>,
    // Connected extension WebSocket sender
    extension_tx: Arc<RwLock<Option<mpsc::Sender<ExtensionCommand>>>>,
    // Credential store with time-window authorization
    credential_store: Arc<CredentialStore>,
}

impl ServerState {
    async fn new() -> Self {
        let credential_store = CredentialStore::new().await
            .expect("Failed to initialize credential store");

        Self {
            pending_requests: Arc::new(RwLock::new(HashMap::new())),
            extension_tx: Arc::new(RwLock::new(None)),
            credential_store: Arc::new(credential_store),
        }
    }

    async fn send_to_extension(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        // Generate request ID
        let id = Uuid::new_v4().to_string();

        // Create response channel
        let (tx, mut rx) = mpsc::channel::<ExtensionResponse>(1);

        // Store pending request
        {
            let mut pending = self.pending_requests.write().await;
            pending.insert(id.clone(), PendingRequest { tx });
        }

        // Send to extension
        let command = ExtensionCommand {
            id: id.clone(),
            method: method.to_string(),
            params,
        };

        let extension_tx = self.extension_tx.read().await;
        if let Some(tx) = extension_tx.as_ref() {
            if tx.send(command).await.is_err() {
                // Clean up
                self.pending_requests.write().await.remove(&id);
                return Err("Extension disconnected".to_string());
            }
        } else {
            // Clean up
            self.pending_requests.write().await.remove(&id);
            return Err("No extension connected".to_string());
        }

        // Wait for response with timeout
        match timeout(Duration::from_secs(30), rx.recv()).await {
            Ok(Some(response)) => {
                // Clean up
                self.pending_requests.write().await.remove(&id);

                if response.success {
                    Ok(response.result.unwrap_or(serde_json::json!({"success": true})))
                } else {
                    Err(response.error.unwrap_or_else(|| "Unknown error".to_string()))
                }
            }
            Ok(None) => {
                // Channel closed
                self.pending_requests.write().await.remove(&id);
                Err("Response channel closed".to_string())
            }
            Err(_) => {
                // Timeout
                self.pending_requests.write().await.remove(&id);
                Err("Request timeout".to_string())
            }
        }
    }

    async fn handle_extension_response(&self, response: ExtensionResponse) {
        let pending = self.pending_requests.read().await;
        if let Some(req) = pending.get(&response.id) {
            let _ = req.tx.send(response).await;
        } else {
            warn!("Received response for unknown request: {}", response.id);
        }
    }
}

// ============================================================================
// MCP Request Handler
// ============================================================================

async fn handle_mcp_request(req: JsonRpcReq, state: Arc<ServerState>) -> JsonRpcRes {
    let id = req.id.clone();
    info!("MCP request: method={}", req.method);

    // Handle built-in methods
    match req.method.as_str() {
        "ping" => {
            JsonRpcRes::ok(id, serde_json::json!({"ok": true}))
        }
        "initialize" => {
            JsonRpcRes::ok(
                id,
                serde_json::json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "agent-browser",
                        "version": "0.1.0"
                    }
                }),
            )
        }
        "tools/list" => {
            JsonRpcRes::ok(
                id,
                serde_json::json!({
                    "tools": [
                        {
                            "name": "playwright_navigate",
                            "description": "Navigate to a URL in the browser",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "url": {
                                        "type": "string",
                                        "description": "The URL to navigate to"
                                    }
                                },
                                "required": ["url"]
                            }
                        },
                        {
                            "name": "playwright_click",
                            "description": "Click an element on the page",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "selector": {
                                        "type": "string",
                                        "description": "CSS selector for the element to click"
                                    }
                                },
                                "required": ["selector"]
                            }
                        },
                        {
                            "name": "playwright_fill",
                            "description": "Fill out an input field",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "selector": {
                                        "type": "string",
                                        "description": "CSS selector for the input element"
                                    },
                                    "value": {
                                        "type": "string",
                                        "description": "The text to type into the input"
                                    }
                                },
                                "required": ["selector", "value"]
                            }
                        },
                        {
                            "name": "playwright_screenshot",
                            "description": "Take a screenshot of the current page or a specific element",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "selector": {
                                        "type": "string",
                                        "description": "Optional CSS selector to screenshot a specific element"
                                    },
                                    "fullPage": {
                                        "type": "boolean",
                                        "description": "Whether to take a full page screenshot"
                                    }
                                }
                            }
                        },
                        {
                            "name": "passkey_enable",
                            "description": "Enable or disable passkey automation for WebAuthn flows",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "enabled": {
                                        "type": "boolean",
                                        "description": "Whether to enable passkey automation"
                                    }
                                },
                                "required": ["enabled"]
                            }
                        },
                        {
                            "name": "passkey_status",
                            "description": "Get the current status of passkey automation",
                            "inputSchema": {
                                "type": "object",
                                "properties": {}
                            }
                        },
                        {
                            "name": "passkey_list",
                            "description": "List all stored passkey credentials",
                            "inputSchema": {
                                "type": "object",
                                "properties": {}
                            }
                        },
                        {
                            "name": "passkey_clear",
                            "description": "Clear all stored passkey credentials",
                            "inputSchema": {
                                "type": "object",
                                "properties": {}
                            }
                        },
                        {
                            "name": "passkey_authorize",
                            "description": "Authorize AI agent to use passkeys for a limited time (requires Touch ID on macOS)",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "duration_hours": {
                                        "type": "number",
                                        "description": "Number of hours to authorize access (default: 8)"
                                    }
                                },
                                "required": []
                            }
                        },
                        {
                            "name": "passkey_authorization_status",
                            "description": "Check if AI agent is currently authorized to use passkeys",
                            "inputSchema": {
                                "type": "object",
                                "properties": {}
                            }
                        },
                        {
                            "name": "playwright_detect_modal",
                            "description": "Detect if a modal, popup, or overlay is present on the page",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "minZIndex": {
                                        "type": "number",
                                        "description": "Minimum z-index to consider (default: 100)"
                                    },
                                    "includeHidden": {
                                        "type": "boolean",
                                        "description": "Include hidden modals (default: false)"
                                    },
                                    "maxResults": {
                                        "type": "number",
                                        "description": "Maximum number of modals to detect (default: 1)"
                                    }
                                }
                            }
                        },
                        {
                            "name": "playwright_dismiss_modal",
                            "description": "Attempt to dismiss any detected modals on the page",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "strategy": {
                                        "type": "string",
                                        "enum": ["auto", "button", "escape", "backdrop", "remove"],
                                        "description": "Dismissal strategy: auto tries all methods, button clicks dismiss button, escape presses ESC, backdrop clicks overlay, remove forcibly removes from DOM (default: auto)"
                                    },
                                    "timeout": {
                                        "type": "number",
                                        "description": "Timeout in milliseconds (default: 5000)"
                                    },
                                    "waitAfter": {
                                        "type": "number",
                                        "description": "Wait time after dismissal to verify (default: 500)"
                                    }
                                }
                            }
                        }
                    ]
                }),
            )
        }
        "tools/call" => {
            // Extract tool name and arguments from MCP format
            let params = req.params.unwrap_or(serde_json::Value::Null);
            let tool_name = params
                .get("name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing tool name".to_string());

            let arguments = params
                .get("arguments")
                .cloned()
                .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

            match tool_name {
                Ok(name) => {
                    // Handle server-side tools (don't forward to extension)
                    match name {
                        "passkey_authorize" => {
                            let duration_hours = arguments
                                .get("duration_hours")
                                .and_then(|v| v.as_f64())
                                .unwrap_or(8.0);

                            let duration = std::time::Duration::from_secs((duration_hours * 3600.0) as u64);

                            return match state.credential_store.authorize_session(duration).await {
                                Ok(_) => JsonRpcRes::ok(
                                    id,
                                    serde_json::json!({
                                        "authorized": true,
                                        "duration_hours": duration_hours,
                                        "message": format!("Authorized for {} hours", duration_hours)
                                    }),
                                ),
                                Err(e) => JsonRpcRes::err(id, -32000, e.to_string(), None),
                            };
                        }
                        "passkey_authorization_status" => {
                            let status = state.credential_store.get_authorization_status().await;
                            return JsonRpcRes::ok(id, status);
                        }
                        _ => {}
                    }

                    // Map MCP tool names to internal command names
                    let internal_method = match name {
                        "playwright_navigate" => "navigate",
                        "playwright_click" => "click",
                        "playwright_fill" => "type",
                        "playwright_screenshot" => "screenshot",
                        "playwright_detect_modal" => "detect_modal",
                        "playwright_dismiss_modal" => "dismiss_modal",
                        "passkey_enable" => "passkey_enable",
                        "passkey_status" => "passkey_status",
                        "passkey_list" => "passkey_list",
                        "passkey_clear" => "passkey_clear",
                        _ => {
                            return JsonRpcRes::err(
                                id,
                                -32601,
                                format!("Unknown tool: {}", name),
                                None,
                            );
                        }
                    };

                    // Special handling for playwright_fill -> type
                    let internal_params = if name == "playwright_fill" {
                        // Rename "value" to "text" for internal type command
                        let mut params_map = match arguments {
                            serde_json::Value::Object(map) => map,
                            _ => serde_json::Map::new(),
                        };
                        if let Some(value) = params_map.remove("value") {
                            params_map.insert("text".to_string(), value);
                        }
                        serde_json::Value::Object(params_map)
                    } else {
                        arguments
                    };

                    // Forward to extension
                    match state.send_to_extension(internal_method, internal_params).await {
                        Ok(result) => JsonRpcRes::ok(
                            id,
                            serde_json::json!({
                                "content": [
                                    {
                                        "type": "text",
                                        "text": serde_json::to_string_pretty(&result).unwrap_or_else(|_| "{}".to_string())
                                    }
                                ]
                            }),
                        ),
                        Err(e) => JsonRpcRes::err(id, -32000, e, None),
                    }
                }
                Err(e) => JsonRpcRes::err(id, -32602, e, None),
            }
        }
        _ => {
            // Forward to extension (for raw method calls)
            let params = req.params.unwrap_or(serde_json::Value::Null);
            match state.send_to_extension(&req.method, params).await {
                Ok(result) => JsonRpcRes::ok(id, result),
                Err(e) => JsonRpcRes::err(id, -32000, e, None),
            }
        }
    }
}

// ============================================================================
// MCP TCP Server
// ============================================================================

async fn run_mcp_tcp(state: Arc<ServerState>) -> Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8084").await?;
    info!("MCP TCP server listening on 127.0.0.1:8084");

    loop {
        let (socket, peer) = listener.accept().await?;
        let state = Arc::clone(&state);
        tokio::spawn(handle_mcp_tcp_connection(socket, peer, state));
    }
}

async fn handle_mcp_tcp_connection(
    socket: TcpStream,
    peer: std::net::SocketAddr,
    state: Arc<ServerState>,
) {
    info!("MCP TCP client connected: {}", peer);

    let (reader, mut writer) = socket.into_split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();

    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => break, // EOF
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                debug!("MCP TCP received: {}", trimmed);

                // Parse JSON-RPC request
                let req: Result<JsonRpcReq, _> = serde_json::from_str(trimmed);
                let response = match req {
                    Ok(req) => handle_mcp_request(req, Arc::clone(&state)).await,
                    Err(e) => {
                        JsonRpcRes::err(None, -32700, format!("Parse error: {}", e), None)
                    }
                };

                // Send response
                let response_json = serde_json::to_string(&response).unwrap();
                if let Err(e) = writer.write_all(response_json.as_bytes()).await {
                    error!("Failed to write MCP TCP response: {}", e);
                    break;
                }
                if let Err(e) = writer.write_all(b"\n").await {
                    error!("Failed to write newline: {}", e);
                    break;
                }
                if let Err(e) = writer.flush().await {
                    error!("Failed to flush: {}", e);
                    break;
                }
            }
            Err(e) => {
                error!("MCP TCP read error: {}", e);
                break;
            }
        }
    }

    info!("MCP TCP client disconnected: {}", peer);
}

// ============================================================================
// MCP Stdio Server
// ============================================================================

async fn run_mcp_stdio(state: Arc<ServerState>) -> Result<()> {
    info!("MCP stdio server started");

    let stdin = tokio::io::stdin();
    let mut reader = BufReader::new(stdin);
    let mut stdout = tokio::io::stdout();
    let mut line = String::new();

    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => break, // EOF
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                debug!("MCP stdio received: {}", trimmed);

                // Parse JSON-RPC request
                let req: Result<JsonRpcReq, _> = serde_json::from_str(trimmed);
                let response = match req {
                    Ok(req) => handle_mcp_request(req, Arc::clone(&state)).await,
                    Err(e) => {
                        JsonRpcRes::err(None, -32700, format!("Parse error: {}", e), None)
                    }
                };

                // Send response
                let response_json = serde_json::to_string(&response).unwrap();
                if let Err(e) = stdout.write_all(response_json.as_bytes()).await {
                    error!("Failed to write MCP stdio response: {}", e);
                    break;
                }
                if let Err(e) = stdout.write_all(b"\n").await {
                    error!("Failed to write newline: {}", e);
                    break;
                }
                if let Err(e) = stdout.flush().await {
                    error!("Failed to flush: {}", e);
                    break;
                }
            }
            Err(e) => {
                error!("MCP stdio read error: {}", e);
                break;
            }
        }
    }

    info!("MCP stdio server stopped");
    Ok(())
}

// ============================================================================
// WebSocket Server (for Extension)
// ============================================================================

async fn run_websocket_server(state: Arc<ServerState>) -> Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8085").await?;
    info!("WebSocket server listening on 127.0.0.1:8085");

    loop {
        let (stream, peer) = listener.accept().await?;
        let state = Arc::clone(&state);
        tokio::spawn(handle_websocket_connection(stream, peer, state));
    }
}

async fn handle_websocket_connection(
    stream: TcpStream,
    peer: std::net::SocketAddr,
    state: Arc<ServerState>,
) {
    info!("WebSocket client connected: {}", peer);

    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            error!("Failed to accept WebSocket: {}", e);
            return;
        }
    };

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // Create channel for sending commands to extension
    let (cmd_tx, mut cmd_rx) = mpsc::channel::<ExtensionCommand>(100);

    // Register this extension
    {
        let mut ext_tx = state.extension_tx.write().await;
        *ext_tx = Some(cmd_tx);
    }

    // Spawn task to send commands from channel to WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(command) = cmd_rx.recv().await {
            let json = match serde_json::to_string(&command) {
                Ok(j) => j,
                Err(e) => {
                    error!("Failed to serialize command: {}", e);
                    continue;
                }
            };

            if let Err(e) = ws_sender.send(WsMessage::Text(json)).await {
                error!("Failed to send WebSocket message: {}", e);
                break;
            }
        }
    });

    // Handle incoming messages from extension
    while let Some(result) = ws_receiver.next().await {
        match result {
            Ok(WsMessage::Text(text)) => {
                debug!("WebSocket received: {}", text);

                // Try to parse as response
                if let Ok(response) = serde_json::from_str::<ExtensionResponse>(&text) {
                    state.handle_extension_response(response).await;
                } else {
                    warn!("Unknown WebSocket message format: {}", text);
                }
            }
            Ok(WsMessage::Close(_)) => {
                info!("WebSocket closed by peer");
                break;
            }
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    // Unregister extension
    {
        let mut ext_tx = state.extension_tx.write().await;
        *ext_tx = None;
    }

    send_task.abort();
    info!("WebSocket client disconnected: {}", peer);
}

// ============================================================================
// Main
// ============================================================================

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    info!("Agent Browser Server starting...");

    let state = Arc::new(ServerState::new().await);

    // Check environment variables for which interfaces to enable
    let mcp_tcp_enabled = env::var("MCP_TCP").is_ok();
    let mcp_stdio_enabled = env::var("MCP_STDIO").is_ok();

    // Always start WebSocket server (for extension)
    let ws_state = Arc::clone(&state);
    let ws_task = tokio::spawn(async move {
        if let Err(e) = run_websocket_server(ws_state).await {
            error!("WebSocket server error: {}", e);
        }
    });

    // Optionally start MCP TCP server
    let tcp_task = if mcp_tcp_enabled {
        info!("MCP_TCP=1 detected, starting MCP TCP server");
        let tcp_state = Arc::clone(&state);
        Some(tokio::spawn(async move {
            if let Err(e) = run_mcp_tcp(tcp_state).await {
                error!("MCP TCP server error: {}", e);
            }
        }))
    } else {
        None
    };

    // Optionally start MCP stdio server
    let stdio_task = if mcp_stdio_enabled {
        info!("MCP_STDIO=1 detected, starting MCP stdio server");
        let stdio_state = Arc::clone(&state);
        Some(tokio::spawn(async move {
            if let Err(e) = run_mcp_stdio(stdio_state).await {
                error!("MCP stdio server error: {}", e);
            }
        }))
    } else {
        None
    };

    info!("Server initialized successfully");
    info!("  - WebSocket: ws://127.0.0.1:8085 (extension)");
    if mcp_tcp_enabled {
        info!("  - MCP TCP: 127.0.0.1:8084");
    }
    if mcp_stdio_enabled {
        info!("  - MCP stdio: enabled");
    }

    // Wait for tasks
    if let Some(t) = tcp_task {
        if let Some(s) = stdio_task {
            tokio::select! {
                _ = ws_task => {},
                _ = t => {},
                _ = s => {},
            }
        } else {
            tokio::select! {
                _ = ws_task => {},
                _ = t => {},
            }
        }
    } else if let Some(s) = stdio_task {
        tokio::select! {
            _ = ws_task => {},
            _ = s => {},
        }
    } else {
        ws_task.await.ok();
    }

    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_operations() {
        assert_eq!(2 + 2, 4);
    }

    #[test]
    fn test_string_operations() {
        let greeting = "Agent Browser";
        assert!(greeting.contains("Browser"));
        assert_eq!(greeting.len(), 13);
    }

    #[test]
    fn test_uuid_generation() {
        let id1 = Uuid::new_v4().to_string();
        let id2 = Uuid::new_v4().to_string();
        assert_ne!(id1, id2);
        assert_eq!(id1.len(), 36); // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    }
}
