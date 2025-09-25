#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { BackendService } from './lib/backend/BackendService';
import { ConfigManager } from './lib/config/ConfigManager';
import { WorkspaceManager, WorkspaceApp } from './lib/workspace/WorkspaceManager';
import { CollisionDetector } from './lib/collision/CollisionDetector';
import { FieldManager } from './lib/field/FieldManager';
import { PollingService } from './lib/polling/PollingService';
import { AssignmentManager } from './lib/assignment/AssignmentManager';
import { ConfigPersistence } from './lib/config/ConfigPersistence';
import { Logger } from './lib/utils/Logger';
import { getHandlerConfig } from './commandMappings';

// Define ToolCallResponse locally to match MCP SDK expectations
type ToolCallResponse = {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
};

import { getToolsForMode, isToolAvailable } from './tools/toolFilter';

export class ALObjectIdServer {
  private server: Server;
  public backendService!: BackendService;
  public configManager!: ConfigManager;
  public workspaceManager!: WorkspaceManager;
  public collisionDetector!: CollisionDetector;
  public fieldManager!: FieldManager;
  public pollingManager!: PollingService;
  public assignmentManager!: AssignmentManager;
  public configPersistence!: ConfigPersistence;
  public logger: Logger;

  // Handler cache to avoid repeated dynamic imports
  private handlerCache: Map<string, (args: Record<string, unknown>) => Promise<ToolCallResponse>> = new Map();

  // Workflow documentation resources
  private resources = {
    'mcp://workflows/workspace-setup': {
      name: 'Workspace Setup Workflow',
      description: 'How to set up and activate an AL app in the workspace',
      mimeType: 'text/markdown',
      content: `# Workspace Setup Workflow

## Overview
Before you can use most AL Object ID Ninja tools, you need to set up your workspace properly. This involves scanning for AL apps and setting an active app.

## Required Steps

### 1. Scan the Workspace
First, scan your workspace to discover AL apps:

\`\`\`
Tool: scan-workspace
Parameters: {
  "workspacePath": "path/to/your/workspace"
}
\`\`\`

This will:
- Search for all AL apps (folders with app.json)
- Load app metadata (ID, name, version, ranges)
- Check authorization status
- Store apps in workspace memory

### 2. Set Active App
After scanning, set which app you want to work with:

\`\`\`
Tool: set-active-app
Parameters: {
  "appPath": "path/to/specific/app"
}
\`\`\`

**Important**: The appPath must match exactly what was returned from scan-workspace (including path separators).

### 3. Verify Setup
Check your workspace configuration:

\`\`\`
Tool: get-workspace-info
Parameters: {}
\`\`\`

## Common Issues

### "Failed to set active app"
- **Cause**: App not in workspace memory
- **Solution**: Run scan-workspace first
- **Note**: Path format must match exactly (Windows uses backslashes)

### "No AL app found"
- **Cause**: Using a tool without active app
- **Solution**: Set active app first

## Tools That Require Active App
- get-next-id
- sync-object-ids
- get-consumption-report
- check-collision
- assign-ids
- All field management tools
`
    },
    'mcp://workflows/quick-start': {
      name: 'Quick Start Guide',
      description: 'Getting started with AL Object ID Ninja MCP',
      mimeType: 'text/markdown',
      content: `# AL Object ID Ninja - Quick Start

## Initial Setup

1. **Scan your workspace**
   \`scan-workspace\` with your project root path

2. **Set active app**
   \`set-active-app\` with the app path

3. **Check authorization**
   \`check-authorization\` to verify app status

4. **Authorize if needed**
   \`authorize-app\` with auth key

## Common Workflows

### Get Next Object ID
\`\`\`
get-next-id
- objectType: "table" | "page" | "report" | etc.
- appPath: optional (uses active app)
- ranges: optional custom ranges
\`\`\`

### Check for Collisions
\`\`\`
check-collision
- objectType: type of object
- id: ID to check
- appPath: optional
\`\`\`

### Interactive Assignment
\`\`\`
assign-ids
- objectType: type of object
- count: number of IDs
- checkCollisions: true/false
- suggestAlternatives: true/false
\`\`\`

## Tips
- Always scan workspace first
- Path formats matter (Windows vs Unix)
- Most tools use active app if appPath not provided
- Use get-workspace-info to debug issues
`
    },
    'mcp://workflows/tool-dependencies': {
      name: 'Tool Dependencies',
      description: 'Which tools depend on others',
      mimeType: 'text/markdown',
      content: `# Tool Dependencies

## Workspace Setup Dependencies

### Prerequisites: scan-workspace
The following tools require scan-workspace to be run first:
- **set-active-app**: Needs apps in workspace memory
- All tools that use appPath parameter (when not provided)

### Prerequisites: set-active-app OR appPath
These tools need either an active app or explicit appPath:
- get-next-id
- sync-object-ids
- check-authorization
- authorize-app
- get-consumption-report
- get-next-field-id
- get-next-enum-value-id
- check-collision
- assign-ids
- batch-assign
- reserve-range
- get-suggestions

### Prerequisites: Authorization
These tools require the app to be authorized:
- get-next-id
- sync-object-ids
- get-consumption-report
- get-next-field-id
- get-next-enum-value-id

## Standalone Tools
These work without prerequisites:
- get-workspace-info
- check-range-overlaps
- start-polling / stop-polling / get-polling-status
- save-preferences / get-preferences
- export-config / import-config
- get-statistics
- get-assignment-history

## Workflow Sequences

### Initial Setup
1. scan-workspace
2. set-active-app
3. check-authorization
4. authorize-app (if needed)

### ID Assignment Flow
1. Setup (above)
2. get-next-id OR assign-ids
3. sync-object-ids (to save to backend)

### Collision Detection Flow
1. Setup (workspace + active app)
2. check-collision OR check-range-overlaps
3. Use alternatives if collisions found
`
    }
  };

  constructor() {
    this.server = new Server({
      name: "al-objid-ninja-mcp",
      version: "0.3.0"
    }, {
      capabilities: {
        tools: {},
        resources: {}
      }
    });

    this.configManager = ConfigManager.getInstance();
    this.workspaceManager = WorkspaceManager.getInstance();
    this.backendService = new BackendService();  // BackendService doesn't use singleton pattern
    this.collisionDetector = CollisionDetector.getInstance();
    this.fieldManager = FieldManager.getInstance();
    this.pollingManager = PollingService.getInstance();
    this.assignmentManager = AssignmentManager.getInstance();
    this.configPersistence = ConfigPersistence.getInstance();
    this.logger = Logger.getInstance();

    // Log the server mode
    const mode = process.env.MCP_MODE?.toLowerCase();
    const actualMode = mode === 'lite' ? 'LITE' : 'FULL';
    this.logger.info(`AL Object ID Ninja MCP Server starting in ${actualMode} mode`);

    // Setup handlers
    this.setupHandlers();

    // Set up polling
    this.setupPolling();

    // Restore configuration
    this.restoreConfiguration();
  }

  private setupHandlers(): void {
    // Get tools based on mode
    const tools = getToolsForMode();

    // Set up the list tools handler
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => ({ tools })
    );

    // Tool call handler
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const { name, arguments: args } = request.params;

        // Check if tool is available in current mode
        if (!isToolAvailable(name)) {
          return {
            content: [
              {
                type: "text",
                text: `Tool '${name}' is not available in current mode`
              }
            ],
            isError: true
          };
        }

        try {
          // Use dynamic handler loading
          return await this.handleToolCallDynamic(name, args || {});
        } catch (error) {
          this.logger.error(`Error handling tool ${name}`, error);
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            ],
            isError: true
          };
        }
      }
    );

    // Handle list resources request
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = Object.entries(this.resources).map(([uri, resource]) => ({
        uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }));

      return { resources };
    });

    // Handle read resource request
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const resource = this.resources[request.params.uri as keyof typeof this.resources];

      if (!resource) {
        throw new Error(`Resource not found: ${request.params.uri}`);
      }

      return {
        contents: [{
          uri: request.params.uri,
          mimeType: resource.mimeType,
          text: resource.content
        }]
      };
    });
  }

  private setupPolling(): void {
    // Set up polling event listeners
    this.pollingManager.on('update', (event) => {
      this.logger.info('Polling update received', event);
      // Could notify through MCP if there was a notification mechanism
    });
  }

  private restoreConfiguration(): void {
    try {
      // Restore polling configuration
      const pollingConfig = this.configPersistence.getPollingConfig();
      if (pollingConfig.enabled) {
        this.pollingManager.start(pollingConfig);
      }

      // Restore preferences
      const preferences = this.configPersistence.getPreferences();
      if (preferences.logLevel) {
        this.logger.setLevel(preferences.logLevel as 'debug' | 'info' | 'warn' | 'error');
      }

      this.logger.info('Configuration restored from persistence');
    } catch (error) {
      this.logger.error('Failed to restore configuration', error);
    }
  }

  // Helper method to get app from path
  public async getAppFromPath(appPath?: string): Promise<WorkspaceApp | null> {
    if (!appPath) {
      // Try to get active app
      const workspace = this.workspaceManager.getCurrentWorkspace();
      if (workspace?.activeApp) {
        return workspace.activeApp;
      }
      return null;
    }

    // Try to find app by path
    let app = this.workspaceManager.getAppByPath(appPath);

    if (!app) {
      // Try scanning if not found
      const workspace = await this.workspaceManager.scanWorkspace(appPath);
      if (workspace.apps.length > 0) {
        app = workspace.apps[0];
      }
    }

    return app || null;
  }

  /**
   * Dynamically loads and executes a handler based on the command name and mode.
   * This replaces the large switch statement with dynamic module loading.
   * Handlers are cached after first load to improve performance.
   *
   * @param name - The command/tool name to handle
   * @param args - The arguments passed to the handler
   * @returns Promise with the handler response or an error
   */
  private async handleToolCallDynamic(name: string, args: Record<string, unknown>): Promise<ToolCallResponse> {
    try {
      // Get the mode from environment (same as toolFilter.ts uses)
      const envMode = process.env.MCP_MODE?.toLowerCase();
      const mode = envMode === 'lite' ? 'lite' : 'full';

      // Create cache key that includes mode to handle mode changes
      const cacheKey = `${mode}:${name}`;

      // Check if handler is already cached
      let handler = this.handlerCache.get(cacheKey);

      if (!handler) {
        // Handler not cached, need to load it
        const handlerConfig = getHandlerConfig(name, mode);

        if (!handlerConfig) {
          return {
            content: [
              {
                type: "text",
                text: `Command "${name}" is not available in ${mode} mode`
              }
            ],
            isError: true
          };
        }

        // Dynamically import the handler module
        const handlerModule = await import(handlerConfig.path);

        // Get the handler function from the module
        handler = handlerModule[handlerConfig.handler];

        if (typeof handler !== 'function') {
          throw new Error(`Handler "${handlerConfig.handler}" not found in module ${handlerConfig.path}`);
        }

        // Cache the handler for future use
        this.handlerCache.set(cacheKey, handler);
        this.logger.debug(`Cached handler for ${name} in ${mode} mode`);
      }

      // Execute the handler with the server context (this) and arguments
      return await handler.call(this, args);

    } catch (error) {
      this.logger.error(`Error in dynamic handler for ${name}:`, error);

      return {
        content: [
          {
            type: "text",
            text: `Failed to execute command "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  // Handler implementations are now loaded dynamically
  // All handler methods have been moved to separate files in handlers/full/ and handlers/standard/
  // They are loaded on demand by handleToolCallDynamic based on command name and mode

  /**
   * Clears the handler cache. Useful for testing or if handlers need to be reloaded.
   * @param name Optional - clear only a specific handler from cache
   */
  public clearHandlerCache(name?: string): void {
    if (name) {
      // Clear specific handler for all tiers
      this.handlerCache.delete(`lite:${name}`);
      this.handlerCache.delete(`full:${name}`);
      this.handlerCache.delete(`standard:${name}`);
      this.logger.debug(`Cleared handler cache for ${name}`);
    } else {
      // Clear all cached handlers
      const size = this.handlerCache.size;
      this.handlerCache.clear();
      this.logger.debug(`Cleared all ${size} cached handlers`);
    }
  }

  /**
   * Gets cache statistics for monitoring
   */
  public getHandlerCacheStats(): { size: number; handlers: string[] } {
    return {
      size: this.handlerCache.size,
      handlers: Array.from(this.handlerCache.keys())
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.logger.info('AL Object ID Ninja MCP server running', {
      transport: 'stdio',
      pid: process.pid
    });

    // Ensure configuration is saved on exit
    process.on('SIGINT', () => {
      this.configPersistence.forceSave();
      process.exit(0);
    });
  }
}

// Start the server
const server = new ALObjectIdServer();
server.run().catch((error) => {
  // Use logger instead of console to avoid breaking stdio transport
  Logger.getInstance().error('Server error:', error);
  process.exit(1);
});