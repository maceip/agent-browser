# LLM Query Service

Multi-modal LLM query service for browser automation assistance.

## Architecture

```
Content Script → Background Script → Offscreen Document (LLM)
      ↓                 ↓                    ↓
query-service.ts  background-handler.ts  offscreen.html
```

## Usage

### From Content Scripts

```typescript
import { getLlmQueryManager, askElementNotFound, askAutomationStuck } from '../llm/query-service';

// Basic query
const manager = getLlmQueryManager();
const response = await manager.query({
  prompt: 'How do I dismiss this modal?',
  context: {
    url: window.location.href,
    selector: '.modal-dialog',
  },
});

// Helper for element not found
const suggestion = await askElementNotFound('.login-button', window.location.href);

// Helper for stuck automation
const help = await askAutomationStuck('click', 'Element not found', 3, window.location.href);
```

### With Screenshots

```typescript
import { getLlmQueryManager } from '../llm/query-service';

// Capture screenshot via background script
const screenshot = await chrome.runtime.sendMessage({
  type: 'capture_screenshot',
});

// Query with visual context
const manager = getLlmQueryManager();
const response = await manager.query({
  prompt: 'What buttons are visible on this page?',
  context: {
    url: window.location.href,
  },
  screenshot: screenshot.dataUrl, // base64 data URL
});
```

### From Agent Stuck Detector

```typescript
import { retryWithLlmHelp } from '../automation/agent-stuck-detector';

// Automatic retry with LLM assistance after 3 failures
const result = await retryWithLlmHelp(
  async () => {
    return await clickCommand(command, config);
  },
  {
    command: 'click',
    selector: '.submit-button',
    url: window.location.href,
    attempt: 1,
    maxAttempts: 5,
  }
);
```

## Background Script Integration

Add to `background.ts`:

```typescript
import {
  setOffscreenReady,
  handleLlmQueryRequest,
  handleLlmChunk,
  handleLlmComplete,
  handleLlmError,
} from './lib/llm/background-handler';

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... existing handlers ...

  // LLM query request from content script
  if (message.type === 'llm_query_request') {
    handleLlmQueryRequest(message)
      .then(response => sendResponse({ success: true, response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // LLM streaming responses from offscreen
  if (message.type === 'llm_chunk') {
    handleLlmChunk(message.id, message.text, activeWebSocket);
    return false;
  }

  if (message.type === 'llm_complete') {
    handleLlmComplete(message.id);
    return false;
  }

  if (message.type === 'llm_error') {
    handleLlmError(message.id, message.error);
    return false;
  }

  // Offscreen ready notification
  if (message.type === 'offscreen_ready') {
    setOffscreenReady(true);
    return false;
  }
});
```

## Rust Server Integration

### WebSocket Message Types

Add to Rust server:

```rust
// Request from Rust → Extension
{
  "type": "llm_query",
  "id": "rust_12345",
  "prompt": "How do I interact with this element?",
  "context": {
    "url": "https://example.com",
    "error": "Element not found",
    "selector": "#submit"
  },
  "screenshot": "data:image/png;base64,..."  // optional
}

// Streaming response Extension → Rust
{
  "type": "llm_chunk",
  "id": "rust_12345",
  "text": "Try using XPath instead..."
}

// Completion Extension → Rust
{
  "type": "llm_complete",
  "id": "rust_12345"
}

// Error Extension → Rust
{
  "type": "llm_error",
  "id": "rust_12345",
  "error": "LLM query timeout"
}
```

### Background Script WebSocket Handler

```typescript
// In background.ts WebSocket handler
if (message.type === 'llm_query') {
  handleLlmQueryRequest(message)
    .then(response => {
      ws.send(JSON.stringify({
        type: 'llm_complete',
        id: message.id,
        response,
      }));
    })
    .catch(error => {
      ws.send(JSON.stringify({
        type: 'llm_error',
        id: message.id,
        error: error.message,
      }));
    });
}
```

## Helper Functions

### askElementNotFound(selector, url)

Asks LLM for alternative selectors when an element cannot be found.

**Returns:**
- Alternative CSS/XPath selectors
- Common visibility issues
- Debug steps

### askAutomationStuck(command, error, attempt, url)

Asks LLM for help when automation gets stuck after multiple attempts.

**Returns:**
- Likely failure causes
- Alternative approaches
- Whether to retry or give up

### askPageStructure(url, goal)

Asks LLM about page structure for complex interactions.

**Returns:**
- Common patterns for page type
- DOM structure hints
- Dynamic content strategies

### askModalHelp(url, modalType?)

Asks LLM for help dismissing modals.

**Returns:**
- Common button text/selectors
- Alternative dismissal methods
- Whether modal should be dismissed

## Configuration

### Timeouts

- Query timeout: 30 seconds (configurable via `LlmQueryManager.queryTimeout`)
- Chunk streaming: Real-time as generated
- Retry on failure: Up to 3 attempts before giving up

### Context Building

The service automatically includes context in prompts:

```
Context:
Current URL: https://example.com/login
Command: click
Selector: .submit-button
Attempt: 3
Error: Element not found

Question:
[user's prompt]
```

## Multi-Modal Support

### Screenshot Format

- Format: Base64-encoded data URL
- Mime type: `image/png` or `image/jpeg`
- Max size: Recommended < 2MB

### Capture Methods

**From Content Script:**
```typescript
// Request background to capture tab
const screenshot = await chrome.runtime.sendMessage({
  type: 'capture_screenshot',
});
```

**From Background Script:**
```typescript
// Capture visible tab
const dataUrl = await chrome.tabs.captureVisibleTab(
  tabId,
  { format: 'png' }
);
```

### Including in Query

```typescript
const response = await manager.query({
  prompt: 'What elements are clickable on this page?',
  screenshot: dataUrl,
});
```

## Error Handling

### Common Errors

- `LLM not ready - still downloading model`: Offscreen document not initialized
- `LLM query timeout after 30s`: Model inference too slow
- `LLM generation failed`: Model error or invalid prompt

### Handling Failures

```typescript
try {
  const response = await manager.query({ prompt: 'Help!' });
} catch (error) {
  if (error.message.includes('not ready')) {
    // Wait for model to load
    console.log('Waiting for LLM to initialize...');
  } else if (error.message.includes('timeout')) {
    // Query too complex or model too slow
    console.log('Simplifying query...');
  } else {
    // Generic error
    console.error('LLM query failed:', error);
  }
}
```

## Performance

### Streaming

Responses stream in chunks as generated:

```typescript
manager.onChunk((id, text) => {
  console.log('Received chunk:', text);
  // Update UI with partial response
});
```

### Caching

No automatic caching - implement at application level if needed:

```typescript
const cache = new Map<string, string>();

async function cachedQuery(prompt: string) {
  if (cache.has(prompt)) {
    return cache.get(prompt);
  }

  const response = await manager.query({ prompt });
  cache.set(prompt, response);
  return response;
}
```

## Testing

See `extension/test/gdpr/` for example implementation with:
- Modal detection and dismissal
- Automatic retry with LLM help
- Multi-page navigation scenarios

## Security

- Queries sent via `chrome.runtime.sendMessage` (internal only)
- No external API calls
- Model runs locally in offscreen document
- Screenshot data never leaves extension
