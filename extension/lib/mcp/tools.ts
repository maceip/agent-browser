/**
 * MCP Tool Definitions
 * All available tools for browser automation and passkey management
 */

import { McpTool } from './types';

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'playwright_navigate',
    description: 'Navigate to a URL in the browser',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to navigate to',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'playwright_click',
    description: 'Click an element on the page',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the element to click',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: 'playwright_fill',
    description: 'Fill out an input field',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the input element',
        },
        value: {
          type: 'string',
          description: 'The text to type into the input',
        },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'playwright_screenshot',
    description: 'Take a screenshot of the current page or a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'Optional CSS selector to screenshot a specific element',
        },
        fullPage: {
          type: 'boolean',
          description: 'Whether to take a full page screenshot',
        },
      },
    },
  },
  {
    name: 'passkey_enable',
    description: 'Enable or disable passkey automation for WebAuthn flows',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Whether to enable passkey automation',
        },
      },
      required: ['enabled'],
    },
  },
  {
    name: 'passkey_status',
    description: 'Get the current status of passkey automation',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'passkey_list',
    description: 'List all stored passkey credentials',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'passkey_clear',
    description: 'Clear all stored passkey credentials',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'passkey_authorize',
    description: 'Authorize AI agent to use passkeys for a limited time (requires Touch ID on macOS)',
    inputSchema: {
      type: 'object',
      properties: {
        duration_hours: {
          type: 'number',
          description: 'Number of hours to authorize access (default: 8)',
        },
      },
      required: [],
    },
  },
  {
    name: 'passkey_authorization_status',
    description: 'Check if AI agent is currently authorized to use passkeys',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'playwright_detect_modal',
    description: 'Detect if a modal, popup, or overlay is present on the page',
    inputSchema: {
      type: 'object',
      properties: {
        minZIndex: {
          type: 'number',
          description: 'Minimum z-index to consider (default: 100)',
        },
        includeHidden: {
          type: 'boolean',
          description: 'Include hidden modals (default: false)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of modals to detect (default: 1)',
        },
      },
    },
  },
  {
    name: 'playwright_dismiss_modal',
    description: 'Attempt to dismiss any detected modals on the page',
    inputSchema: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['auto', 'button', 'escape', 'backdrop', 'remove'],
          description:
            'Dismissal strategy: auto tries all methods, button clicks dismiss button, escape presses ESC, backdrop clicks overlay, remove forcibly removes from DOM (default: auto)',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 5000)',
        },
        waitAfter: {
          type: 'number',
          description: 'Wait time after dismissal to verify (default: 500)',
        },
      },
    },
  },
];
