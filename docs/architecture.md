# Architecture

Agent Browser consists of three main components that work together to provide MCP-based browser automation.

## System Architecture

```mermaid
graph TB
    subgraph "Claude Environment"
        Claude[Claude Desktop/Code]
    end

    subgraph "MCP Layer"
        MCP_STDIO[MCP stdio Interface]
        MCP_TCP[MCP TCP Interface<br/>localhost:8084]
    end

    subgraph "Rust Server<br/>/usr/local/bin/agent-browser-server"
        Server[Main Server Process]
        CredStore[Credential Store<br/>AES-256-GCM]
        WS_Server[WebSocket Server<br/>localhost:8085]
        NMH[Native Messaging Host]
    end

    subgraph "Chrome Browser"
        Extension[Chrome Extension]
        Background[Background Script]
        Content[Content Scripts]
        Offscreen[Offscreen Document<br/>Local LLM]
        WebAuthn[WebAuthn Proxy]
    end

    subgraph "Storage"
        LocalStorage[~/.agent-browser/<br/>credentials.json<br/>master.key<br/>audit.log]
        ChromeStorage[Chrome Storage<br/>Email Config<br/>Preferences]
    end

    Claude -->|JSON-RPC| MCP_STDIO
    Claude -->|JSON-RPC| MCP_TCP
    MCP_STDIO --> Server
    MCP_TCP --> Server
    Server <-->|WebSocket| WS_Server
    WS_Server <-->|WebSocket| Extension
    Extension --> Background
    Background --> Content
    Background --> Offscreen
    Background --> WebAuthn
    Server --> CredStore
    Server --> NMH
    NMH -.->|Keeps Alive| Server
    CredStore <--> LocalStorage
    Extension <--> ChromeStorage
    Content -.->|DOM Automation| Webpage[Web Pages]
    WebAuthn -.->|Passkey Auth| Webpage
```

## Component Details

### 1. MCP Interfaces

The Rust server exposes two MCP interfaces:

- **stdio**: Used by Claude Desktop/Code via `MCP_STDIO=1`
- **TCP**: Available on `localhost:8084` via `MCP_TCP=1`

Both interfaces accept JSON-RPC requests and route them to the Chrome extension via WebSocket.

### 2. Rust Server

Core responsibilities:

- **MCP Protocol Handler**: Parses JSON-RPC requests from Claude
- **WebSocket Bridge**: Forwards commands to Chrome extension on port 8085
- **Credential Store**: Manages encrypted passkey storage with time-bound authorization
- **Native Messaging Host**: Ensures server runs when Chrome is active

### 3. Chrome Extension

Multi-component extension:

- **Background Script**: Coordinates between MCP server and content scripts
- **Content Scripts**: Execute DOM automation in web pages
- **Offscreen Document**: Hosts local LLM (Gemma 3N) for automation assistance
- **WebAuthn Proxy**: Intercepts and manages passkey credential requests

### 4. Storage Layer

Two independent storage systems:

- **Local Filesystem** (`~/.agent-browser/`):
  - `credentials.json`: Encrypted passkey credentials
  - `master.key`: AES-256-GCM encryption key (0600 permissions)
  - `audit.log`: Credential access audit trail

- **Chrome Storage**:
  - Email provider configuration (IMAP/OAuth)
  - Automation preferences and delays
  - Authorization window settings

## Data Flow

### Browser Automation Request

```mermaid
sequenceDiagram
    participant Claude
    participant Server
    participant WS as WebSocket Bridge
    participant Ext as Extension
    participant Content as Content Script
    participant Page as Web Page

    Claude->>Server: navigate(url)
    Server->>WS: Forward command
    WS->>Ext: WebSocket message
    Ext->>Content: Execute navigation
    Content->>Page: window.location.href = url
    Content-->>Ext: Navigation complete
    Ext-->>WS: Success response
    WS-->>Server: Forward response
    Server-->>Claude: JSON-RPC result
```

### Passkey Authentication Request

```mermaid
sequenceDiagram
    participant Page as Web Page
    participant WebAuthn as WebAuthn Proxy
    participant Ext as Extension
    participant Server
    participant Store as Credential Store

    Page->>WebAuthn: navigator.credentials.get()
    WebAuthn->>Ext: Request credential
    Ext->>Server: get_credential(rpId)
    Server->>Store: Check authorization
    alt Authorized
        Store->>Server: Return credential
        Server->>Ext: Credential data
        Ext->>WebAuthn: Credential object
        WebAuthn->>Page: Assertion response
    else Not Authorized
        Store-->>Server: Authorization required
        Server-->>Ext: Authorization error
        Ext-->>WebAuthn: Error
        WebAuthn-->>Page: Error
    end
```

### LLM-Assisted Automation

```mermaid
sequenceDiagram
    participant Content as Content Script
    participant Ext as Extension
    participant Offscreen as Offscreen LLM
    participant Modal as Modal Detector

    Content->>Modal: detectModal()
    Modal-->>Content: Modal found
    Content->>Ext: Request LLM help
    Ext->>Offscreen: Query("How to dismiss modal?")
    Offscreen->>Offscreen: Local inference
    Offscreen-->>Ext: Suggestion (streaming)
    Ext-->>Content: Dismissal strategy
    Content->>Content: Apply strategy
    Content-->>Ext: Modal dismissed
```

## Security Architecture

### Credential Protection

```mermaid
graph LR
    subgraph "Threat Surface"
        Web[Web Pages]
        Extensions[Other Extensions]
        OS[Operating System]
    end

    subgraph "Protection Layers"
        Isolation[Extension Isolation]
        Encryption[AES-256-GCM]
        TimeAuth[Time-Bound Auth]
        Audit[Audit Logging]
    end

    subgraph "Protected Data"
        Credentials[Passkey Credentials]
        MasterKey[Master Encryption Key]
        PrivateKeys[Private Keys]
    end

    Web -.->|Blocked| Isolation
    Extensions -.->|Blocked| Isolation
    OS -->|File Permissions| Encryption
    Isolation --> TimeAuth
    Encryption --> TimeAuth
    TimeAuth --> Credentials
    TimeAuth --> MasterKey
    TimeAuth --> PrivateKeys
    Credentials --> Audit
    MasterKey --> Audit
    PrivateKeys --> Audit
```

### Authorization Flow

1. User requests passkey usage
2. Extension checks session authorization status
3. If expired, prompts for authorization with duration
4. Server validates and grants time-bound access
5. All credential operations logged to audit.log
6. Authorization automatically expires after duration

## Communication Protocols

### MCP JSON-RPC

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "navigate",
    "arguments": {
      "url": "https://example.com"
    }
  }
}
```

### WebSocket Messages

```json
{
  "type": "command",
  "id": "cmd_abc123",
  "method": "click",
  "params": {
    "selector": "#submit-button",
    "mode": "stealth"
  }
}
```

### Chrome Extension Messages

```json
{
  "type": "llm_query_request",
  "id": "llm_xyz789",
  "prompt": "How do I dismiss this GDPR modal?",
  "screenshot": "data:image/png;base64,..."
}
```

## Performance Characteristics

- **WebSocket latency**: <5ms (localhost)
- **MCP command overhead**: 10-20ms
- **Modal detection**: 50-200ms
- **LLM inference**: 1-3s per query (local)
- **Credential decryption**: <10ms

## Scalability

Current architecture is single-user, single-browser:

- One server instance per user
- One WebSocket connection to extension
- Sequential command processing
- Local-only LLM inference

Future improvements could include:

- Multi-browser support (Firefox, Safari)
- Concurrent command execution
- Remote LLM option for faster inference
- Distributed credential storage
