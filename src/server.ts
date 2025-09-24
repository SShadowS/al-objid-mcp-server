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
import { ALObjectType } from './lib/types/ALObjectType';
import { DEFAULT_EXTENSION_RANGES } from './lib/constants/ranges';
import {
  GetNextObjectIdArgs,
  ReserveIdArgs,
  SyncObjectIdsArgs,
  AuthorizeAppArgs,
  CheckAuthorizationArgs,
  GetConsumptionReportArgs,
  ScanWorkspaceArgs,
  GetWorkspaceInfoArgs,
  SetActiveAppArgs,
  GetNextFieldIdArgs,
  GetNextEnumValueIdArgs,
  CheckCollisionArgs,
  CheckRangeOverlapsArgs,
  StartPollingArgs,
  StopPollingArgs,
  GetPollingStatusArgs,
  AssignIdsArgs,
  BatchAssignArgs,
  ReserveRangeArgs,
  GetSuggestionsArgs,
  GetAssignmentHistoryArgs,
  SavePreferencesArgs,
  GetPreferencesArgs,
  ExportConfigArgs,
  ImportConfigArgs,
  GetStatisticsArgs
} from './lib/types/ToolHandlerArgs';

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

  // Workflow documentation resources
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
          switch (name) {
            // Core ID Management
            case "get-next-id":
              return await this.handleGetNextObjectId(args as unknown as GetNextObjectIdArgs);
            case "reserve-id":
              return await this.handleReserveId(args as unknown as ReserveIdArgs);
            case "sync-object-ids":
              return await this.handleSyncObjectIds(args as unknown as SyncObjectIdsArgs);

            // Authorization & Backend
            case "check-authorization":
              return await this.handleCheckAuthorization(args as CheckAuthorizationArgs);
            case "authorize-app":
              return await this.handleAuthorizeApp(args as AuthorizeAppArgs);
            case "get-consumption-report":
              return await this.handleGetConsumptionReport(args as GetConsumptionReportArgs);

            // Workspace Management
            case "scan-workspace":
              return await this.handleScanWorkspace(args as unknown as ScanWorkspaceArgs);
            case "get-workspace-info":
              return await this.handleGetWorkspaceInfo(args as GetWorkspaceInfoArgs);
            case "set-active-app":
              return await this.handleSetActiveApp(args as SetActiveAppArgs);

            // Field Management
            case "get-next-field-id":
              return await this.handleGetNextFieldId(args as unknown as GetNextFieldIdArgs);
            case "get-next-enum-value-id":
              return await this.handleGetNextEnumValueId(args as unknown as GetNextEnumValueIdArgs);

            // Collision Detection
            case "check-collision":
              return await this.handleCheckCollision(args as unknown as CheckCollisionArgs);
            case "check-range-overlaps":
              return await this.handleCheckRangeOverlaps(args as CheckRangeOverlapsArgs);

            // Polling Management
            case "start-polling":
              return await this.handleStartPolling(args as StartPollingArgs);
            case "stop-polling":
              return await this.handleStopPolling(args as StopPollingArgs);
            case "get-polling-status":
              return await this.handleGetPollingStatus(args as GetPollingStatusArgs);

            // Interactive Assignment
            case "assign-ids":
              return await this.handleAssignIds(args as unknown as AssignIdsArgs);
            case "batch-assign":
              return await this.handleBatchAssign(args as unknown as BatchAssignArgs);
            case "reserve-range":
              return await this.handleReserveRange(args as unknown as ReserveRangeArgs);
            case "get-suggestions":
              return await this.handleGetSuggestions(args as unknown as GetSuggestionsArgs);
            case "get-assignment-history":
              return await this.handleGetAssignmentHistory(args as GetAssignmentHistoryArgs);

            // Configuration Management
            case "save-preferences":
              return await this.handleSavePreferences(args as unknown as SavePreferencesArgs);
            case "get-preferences":
              return await this.handleGetPreferences(args as GetPreferencesArgs);
            case "export-config":
              return await this.handleExportConfig(args as ExportConfigArgs);
            case "import-config":
              return await this.handleImportConfig(args as unknown as ImportConfigArgs);
            case "get-statistics":
              return await this.handleGetStatistics(args as GetStatisticsArgs);

            default:
              return {
                content: [
                  {
                    type: "text",
                    text: `Unknown tool: ${name}`
                  }
                ]
              };
          }
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

  // Handler implementations

  /**
   * Handles retrieval of the next available object ID without committing it.
   * Supports standard AL objects, field IDs for tables, and enum values.
   * This is a query-only operation that does not reserve or consume the ID.
   *
   * @param args - The arguments containing:
   *   - appPath: Optional path to the AL app
   *   - objectType: Type of object (e.g., 'table', 'page', 'field', 'enum')
   *   - parentObjectId: For field/enum values, the parent table/enum ID
   *   - ranges: Optional ID ranges to use (defaults to app ranges or extension ranges)
   * @returns Promise with the next available ID or an error message
   *
   * @remarks
   * Enhanced for lite mode to support field and enum value ID queries.
   * Uses special object type format: `table_${tableId}` for fields and `enum_${enumId}` for enum values.
   * Does not commit the ID - use handleReserveId to actually reserve an ID.
   */
  private async handleGetNextObjectId(args: GetNextObjectIdArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found at the specified path" }],
        isError: true
      };
    }

    if (!app.isAuthorized || !app.authKey) {
      return {
        content: [{ type: "text", text: "App is not authorized. Please authorize first." }],
        isError: true
      };
    }

    // Handle field/enum value requests
    if (args.parentObjectId) {
      const ranges = args.ranges || app.ranges || DEFAULT_EXTENSION_RANGES;

      if (args.objectType === 'field' || args.objectType === 'table') {
        // Get field ID
        const fieldId = await this.fieldManager.getNextFieldId(
          app.appId,
          app.authKey,
          args.parentObjectId,
          ranges
        );

        if (fieldId) {
          return {
            content: [{
              type: "text",
              text: `Next available field ID for table ${args.parentObjectId}: ${fieldId}\nUse 'reserve-id' to claim this ID.`
            }]
          };
        } else {
          return {
            content: [{ type: "text", text: `No available field IDs for table ${args.parentObjectId}` }],
            isError: true
          };
        }
      } else if (args.objectType === 'enum') {
        // Get enum value ID
        const enumValueId = await this.fieldManager.getNextEnumValueId(
          app.appId,
          app.authKey,
          args.parentObjectId,
          ranges
        );

        if (enumValueId) {
          return {
            content: [{
              type: "text",
              text: `Next available enum value for enum ${args.parentObjectId}: ${enumValueId}\nUse 'reserve-id' to claim this ID.`
            }]
          };
        } else {
          return {
            content: [{ type: "text", text: `No available enum values for enum ${args.parentObjectId}` }],
            isError: true
          };
        }
      }
    }

    // Standard object ID request (query only, no commit)
    const objectType = args.objectType as ALObjectType;
    const ranges = args.ranges || app.ranges || DEFAULT_EXTENSION_RANGES;

    // Use pool ID if available (matches VSCode extension behavior)
    const appId = this.workspaceManager.getPoolIdFromAppIdIfAvailable(app.appId);

    const request = {
      appId,
      type: objectType,
      ranges,
      authKey: app.authKey,
      perRange: false
    };

    // Query without committing (GET request)
    const result = await this.backendService.getNext(request, false);

    if (result && result.available) {
      // Handle both single ID and array of IDs
      const id = Array.isArray(result.id) ? result.id[0] : result.id;

      // Check for collisions
      const collision = await this.collisionDetector.checkCollision(objectType, id, app);

      if (collision) {
        return {
          content: [{
            type: "text",
            text: `Next available ${objectType} ID: ${id}\n⚠️ Warning: Potential collision with ${collision.apps.map(a => a.appName).join(', ')}\nUse 'reserve-id' to claim this ID.`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: `Next available ${objectType} ID: ${id}\nUse 'reserve-id' to claim this ID.`
        }]
      };
    }

    return {
      content: [{ type: "text", text: `No available IDs in the specified ranges` }],
      isError: true
    };
  }

  /**
   * Handles reservation of specific object IDs, including standard objects, fields, and enum values.
   * This method commits the ID reservation to the backend and uses storeAssignment for real-time tracking
   * to avoid overwriting existing consumption data.
   *
   * @param args - The arguments containing:
   *   - appPath: Path to the AL app
   *   - objectType: Type of object (e.g., 'table', 'page', 'field', 'enum')
   *   - id: The specific ID to reserve
   *   - parentObjectId: For field/enum values, the parent table/enum ID
   *   - ranges: Optional ID ranges to use
   * @returns Promise with the tool response indicating success or failure
   *
   * @remarks
   * For field and enum value reservations, uses storeAssignment API to add individual IDs
   * to consumption tracking without overwriting existing data. This prevents the issue
   * where syncIds would replace all consumption with just the new ID.
   */
  private async handleReserveId(args: ReserveIdArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found at the specified path" }],
        isError: true
      };
    }

    if (!app.isAuthorized || !app.authKey) {
      return {
        content: [{ type: "text", text: "App is not authorized. Please authorize first." }],
        isError: true
      };
    }

    // Handle field/enum value reservation
    if (args.parentObjectId) {
      const ranges = app.ranges || DEFAULT_EXTENSION_RANGES;

      if (args.objectType === 'field' || args.objectType === 'table') {
        // Reserve field ID
        const success = await this.fieldManager.reserveFieldId(
          app.appId,
          app.authKey,
          args.parentObjectId,
          args.id,
          ranges
        );

        if (success) {
          // Use storeAssignment for real-time tracking without overwriting consumption
          const objectType = `table_${args.parentObjectId}`;
          const poolId = this.workspaceManager.getPoolIdFromAppIdIfAvailable(app.appId);
          await this.backendService.storeAssignment(
            poolId,
            app.authKey,
            objectType,
            args.id,
            'POST'
          );

          return {
            content: [{
              type: "text",
              text: `✓ Reserved field ID ${args.id} for table ${args.parentObjectId}`
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `✗ Failed to reserve field ID ${args.id} - may already be in use`
            }],
            isError: true
          };
        }
      } else if (args.objectType === 'enum') {
        // Reserve enum value
        const success = await this.fieldManager.reserveEnumValueId(
          app.appId,
          app.authKey,
          args.parentObjectId,
          args.id,
          ranges
        );

        if (success) {
          // Use storeAssignment for real-time tracking without overwriting consumption
          const objectType = `enum_${args.parentObjectId}`;
          const poolId = this.workspaceManager.getPoolIdFromAppIdIfAvailable(app.appId);
          await this.backendService.storeAssignment(
            poolId,
            app.authKey,
            objectType,
            args.id,
            'POST'
          );

          return {
            content: [{
              type: "text",
              text: `✓ Reserved enum value ${args.id} for enum ${args.parentObjectId}`
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `✗ Failed to reserve enum value ${args.id} - may already be in use`
            }],
            isError: true
          };
        }
      }
    }

    // Standard object ID reservation
    const objectType = args.objectType as ALObjectType;
    const ranges = app.ranges || DEFAULT_EXTENSION_RANGES;
    const appId = this.workspaceManager.getPoolIdFromAppIdIfAvailable(app.appId);

    // Validate ID is within allowed ranges
    const inRange = ranges.some(r => args.id >= r.from && args.id <= r.to);
    if (!inRange) {
      return {
        content: [{
          type: "text",
          text: `✗ ID ${args.id} is outside allowed ranges`
        }],
        isError: true
      };
    }

    const request = {
      appId,
      type: objectType,
      ranges,
      authKey: app.authKey,
      perRange: false,
      require: args.id  // Specific ID to reserve
    };

    // Commit the reservation (POST request)
    const result = await this.backendService.getNext(request, true);

    if (result && result.available) {
      const reservedId = Array.isArray(result.id) ? result.id[0] : result.id;

      if (reservedId === args.id) {
        // Successfully reserved the requested ID
        // Track the assignment
        await this.assignmentManager.assignIds(app, {
          objectType,
          count: 1,
          description: `Reserved ${objectType} ID ${args.id}`
        });

        return {
          content: [{
            type: "text",
            text: `✓ Successfully reserved ${objectType} ID: ${args.id}`
          }]
        };
      } else {
        // Different ID was returned - original was taken
        return {
          content: [{
            type: "text",
            text: `✗ ID ${args.id} is already taken. Next available: ${reservedId}\nUse 'get-next-id' to find another available ID.`
          }],
          isError: true
        };
      }
    }

    return {
      content: [{
        type: "text",
        text: `✗ Failed to reserve ${objectType} ID ${args.id}`
      }],
      isError: true
    };
  }

  private async handleCheckAuthorization(args: CheckAuthorizationArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found at the specified path" }],
        isError: true
      };
    }

    if (app.isAuthorized) {
      return {
        content: [{
          type: "text",
          text: `✅ App "${app.name}" is authorized`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `❌ App "${app.name}" is not authorized`
      }]
    };
  }

  private async handleAuthorizeApp(args: AuthorizeAppArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found at the specified path" }],
        isError: true
      };
    }

    // Use pool ID if available (matches VSCode extension behavior)
    const appId = this.workspaceManager.getPoolIdFromAppIdIfAvailable(app.appId);

    // For now, use simplified authorization (Phase 4 will add full git integration)
    const request = {
      appId,
      appName: app.name,
      gitUser: 'user',
      gitEmail: 'user@example.com',
      gitRepo: 'repo',
      gitBranch: 'main'
    };

    const result = await this.backendService.authorizeApp(request);

    if (result) {
      // Update workspace manager with the result auth key
      this.workspaceManager.updateAppAuthorization(app.path, result.authKey);
      
      // Save to persistence
      const workspace = this.workspaceManager.getCurrentWorkspace();
      if (workspace) {
        this.configPersistence.saveWorkspace(
          workspace.rootPath,
          workspace.apps,
          workspace.activeApp?.appId
        );
      }

      return {
        content: [{
          type: "text",
          text: `✅ App "${app.name}" has been authorized successfully`
        }]
      };
    }

    return {
      content: [{ type: "text", text: "Authorization failed. Please check the auth key." }],
      isError: true
    };
  }

  private async handleSyncObjectIds(args: SyncObjectIdsArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found at the specified path" }],
        isError: true
      };
    }

    if (!app.isAuthorized || !app.authKey) {
      return {
        content: [{ type: "text", text: "App is not authorized. Please authorize first." }],
        isError: true
      };
    }

    // Use pool ID if available (matches VSCode extension behavior)
    const appId = this.workspaceManager.getPoolIdFromAppIdIfAvailable(app.appId);
    
    // Support sync modes: merge (UPDATE/PATCH) or replace (REPLACE/POST)
    const merge = args.merge === true || args.mode === 'UPDATE' || args.mode === 'merge';
    
    const result = await this.backendService.syncIds({
      appId,
      authKey: app.authKey,
      ids: args.ids,
      merge
    });

    if (result) {
      // Record in persistence
      for (const [objectType, ids] of Object.entries(args.ids)) {
        if (Array.isArray(ids)) {
          this.configPersistence.addAssignmentHistory(
            app.appId,
            objectType,
            ids,
            `${merge ? 'Merge' : 'Replace'} sync`
          );
        }
      }

      return {
        content: [{
          type: "text",
          text: `✅ Successfully synced object IDs for app "${app.name}" (${merge ? 'MERGE' : 'REPLACE'} mode)`
        }]
      };
    }

    return {
      content: [{ type: "text", text: "Failed to sync object IDs" }],
      isError: true
    };
  }

  private async handleGetConsumptionReport(args: GetConsumptionReportArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found at the specified path" }],
        isError: true
      };
    }

    if (!app.isAuthorized || !app.authKey) {
      return {
        content: [{ type: "text", text: "App is not authorized. Please authorize first." }],
        isError: true
      };
    }

    const objectTypes = args.objectTypes || [
      ALObjectType.Table,
      ALObjectType.Page,
      ALObjectType.Report,
      ALObjectType.Codeunit,
      ALObjectType.Query,
      ALObjectType.XmlPort,
      ALObjectType.Enum
    ];

    const report: Record<string, number[]> = {};

    // Get all consumption at once using pool ID if available (matches VSCode extension behavior)
    const appId = this.workspaceManager.getPoolIdFromAppIdIfAvailable(app.appId);
    const request = {
      appId,
      authKey: app.authKey
    };
    const consumptionInfo = await this.backendService.getConsumption(request);

    if (consumptionInfo) {
      for (const objectType of objectTypes) {
        const consumption = consumptionInfo[objectType as ALObjectType] || [];
        if (consumption.length > 0) {
          report[objectType] = consumption;
        }
      }
    }

    const summary = Object.entries(report)
      .map(([type, ids]) => `${type}: ${ids.length} IDs (${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''})`)
      .join('\n');

    return {
      content: [{
        type: "text",
        text: `📊 Consumption Report for "${app.name}":\n\n${summary || 'No consumed IDs found'}`
      }]
    };
  }

  private async handleScanWorkspace(args: ScanWorkspaceArgs): Promise<ToolCallResponse> {
    const workspace = await this.workspaceManager.scanWorkspace(args.workspacePath);

    // Save to persistence
    this.configPersistence.saveWorkspace(
      workspace.rootPath,
      workspace.apps,
      workspace.activeApp?.appId
    );

    const appList = workspace.apps
      .map(app => `- ${app.name} v${app.version} ${app.isAuthorized ? '✅' : '❌'}`)
      .join('\n');

    return {
      content: [{
        type: "text",
        text: `Found ${workspace.apps.length} AL app(s):\n${appList}`
      }]
    };
  }

  private async handleGetWorkspaceInfo(_args: GetWorkspaceInfoArgs): Promise<ToolCallResponse> {
    const workspace = this.workspaceManager.getCurrentWorkspace();
    
    if (!workspace) {
      return {
        content: [{ type: "text", text: "No workspace is currently active" }],
        isError: true
      };
    }

    const info = {
      rootPath: workspace.rootPath,
      appCount: workspace.apps.length,
      apps: workspace.apps.map(app => ({
        name: app.name,
        version: app.version,
        authorized: app.isAuthorized,
        path: app.path
      })),
      activeApp: workspace.activeApp?.name || 'None'
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(info, null, 2)
      }]
    };
  }

  private async handleSetActiveApp(args: SetActiveAppArgs): Promise<ToolCallResponse> {
    const success = this.workspaceManager.setActiveApp(args.appPath || '');

    if (success) {
      const workspace = this.workspaceManager.getCurrentWorkspace();
      if (workspace) {
        // Save to persistence
        this.configPersistence.saveWorkspace(
          workspace.rootPath,
          workspace.apps,
          workspace.activeApp?.appId
        );

        return {
          content: [{
            type: "text",
            text: `✅ Active app set to: ${workspace.activeApp?.name}`
          }]
        };
      }
    }

    return {
      content: [{ type: "text", text: "Failed to set active app" }],
      isError: true
    };
  }

  private async handleGetNextFieldId(args: GetNextFieldIdArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    if (!app.isAuthorized || !app.authKey) {
      return {
        content: [{ type: "text", text: "App is not authorized" }],
        isError: true
      };
    }

    const ranges = app.ranges || DEFAULT_EXTENSION_RANGES;
    const fieldId = await this.fieldManager.getNextFieldId(
      app.appId,
      app.authKey,
      args.tableId,
      ranges
    );

    if (fieldId > 0) {
      return {
        content: [{
          type: "text",
          text: `Next available field ID for table ${args.tableId}: ${fieldId}`
        }]
      };
    }

    return {
      content: [{ type: "text", text: "No available field IDs" }],
      isError: true
    };
  }

  private async handleGetNextEnumValueId(args: GetNextEnumValueIdArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    if (!app.isAuthorized || !app.authKey) {
      return {
        content: [{ type: "text", text: "App is not authorized" }],
        isError: true
      };
    }

    const ranges = app.ranges || DEFAULT_EXTENSION_RANGES;
    const valueId = await this.fieldManager.getNextEnumValueId(
      app.appId,
      app.authKey,
      args.enumId,
      ranges
    );

    if (valueId >= 0) {
      return {
        content: [{
          type: "text",
          text: `Next available enum value ID for enum ${args.enumId}: ${valueId}`
        }]
      };
    }

    return {
      content: [{ type: "text", text: "No available enum value IDs" }],
      isError: true
    };
  }

  private async handleCheckCollision(args: CheckCollisionArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    const collision = await this.collisionDetector.checkCollision(
      args.objectType as ALObjectType,
      args.id,
      app
    );

    if (collision) {
      const conflictingApps = collision.apps
        .map(a => `- ${a.appName} (${a.appPath})`)
        .join('\n');

      return {
        content: [{
          type: "text",
          text: `⚠️ Collision detected!\n\n${collision.message}\n\nConflicting apps:\n${conflictingApps}`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `✅ No collision detected for ${args.objectType} ID ${args.id}`
      }]
    };
  }

  private async handleCheckRangeOverlaps(_args: CheckRangeOverlapsArgs): Promise<ToolCallResponse> {
    const overlaps = await this.collisionDetector.checkRangeOverlaps();

    if (overlaps.length === 0) {
      return {
        content: [{
          type: "text",
          text: "✅ No range overlaps detected between apps"
        }]
      };
    }

    const overlapList = overlaps
      .map(o => `- ${o.message}`)
      .join('\n');

    return {
      content: [{
        type: "text",
        text: `⚠️ Range overlaps detected:\n\n${overlapList}`
      }]
    };
  }

  private async handleStartPolling(args: StartPollingArgs): Promise<ToolCallResponse> {
    const config = {
      enabled: true,
      interval: args.interval || 30000,
      checkConsumption: args.features?.consumption !== false,
      checkCollisions: args.features?.collisions !== false,
      checkPools: args.features?.pools || false
    };

    this.pollingManager.start(config);

    // Save to persistence
    this.configPersistence.savePollingConfig(config);

    return {
      content: [{
        type: "text",
        text: `✅ Polling started with interval: ${config.interval}ms`
      }]
    };
  }

  private async handleStopPolling(_args: StopPollingArgs): Promise<ToolCallResponse> {
    this.pollingManager.stop();

    // Update persistence
    const config = this.configPersistence.getPollingConfig();
    config.enabled = false;
    this.configPersistence.savePollingConfig(config);

    return {
      content: [{
        type: "text",
        text: "✅ Polling stopped"
      }]
    };
  }

  private async handleGetPollingStatus(_args: GetPollingStatusArgs): Promise<ToolCallResponse> {
    const status = this.pollingManager.getStatus();

    return {
      content: [{
        type: "text",
        text: JSON.stringify(status, null, 2)
      }]
    };
  }

  // Phase 4: Interactive Assignment handlers

  private async handleAssignIds(args: AssignIdsArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    const result = await this.assignmentManager.assignIds(app, {
      objectType: args.objectType as ALObjectType,
      count: args.count,
      ranges: args.ranges,
      description: args.description,
      checkCollisions: args.checkCollisions !== false,
      suggestAlternatives: args.suggestAlternatives !== false
    });

    if (result.success) {
      // Save to persistence
      this.configPersistence.addAssignmentHistory(
        app.appId,
        args.objectType,
        result.ids,
        args.description
      );

      let response = `✅ Assigned ${result.ids.length} ID(s): ${result.ids.join(', ')}`;
      
      if (result.collisions && result.collisions.length > 0) {
        response += `\n\n⚠️ Collisions detected:\n${result.collisions.map(c => 
          `- ID ${c.id} conflicts with ${c.conflictingApps.join(', ')}`
        ).join('\n')}`;
      }

      if (result.alternatives && result.alternatives.length > 0) {
        response += `\n\n💡 Alternative IDs: ${result.alternatives.join(', ')}`;
      }

      return { content: [{ type: "text", text: response }] };
    }

    return {
      content: [{ type: "text", text: result.message || "Failed to assign IDs" }],
      isError: true
    };
  }

  private async handleBatchAssign(args: BatchAssignArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    const results = await this.assignmentManager.batchAssign(app, args.assignments.map(a => ({
      ...a,
      objectType: a.objectType as ALObjectType
    })));

    const summary = results.map(r => {
      const status = r.success ? '✅' : '❌';
      const ids = r.ids.length > 0 ? r.ids.join(', ') : 'None';
      return `${status} ${r.objectType}: ${ids}`;
    }).join('\n');

    return {
      content: [{
        type: "text",
        text: `Batch assignment results:\n\n${summary}`
      }]
    };
  }

  private async handleReserveRange(args: ReserveRangeArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    const success = await this.assignmentManager.reserveRange(
      app,
      args.objectType as ALObjectType,
      args.from,
      args.to,
      args.description
    );

    if (success) {
      const count = args.to - args.from + 1;
      return {
        content: [{
          type: "text",
          text: `✅ Reserved ${count} IDs (${args.from}-${args.to}) for ${args.objectType}`
        }]
      };
    }

    return {
      content: [{ type: "text", text: "Failed to reserve range" }],
      isError: true
    };
  }

  private async handleGetSuggestions(args: GetSuggestionsArgs): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    const suggestions = await this.assignmentManager.getSuggestions(
      app,
      args.objectType as ALObjectType,
      args.pattern
    );

    let response = `📊 ID Assignment Suggestions for ${args.objectType}:\n\n`;
    response += `Next available: ${suggestions.nextAvailable || 'None'}\n\n`;

    if (suggestions.suggestedRanges.length > 0) {
      response += `Suggested ranges:\n`;
      suggestions.suggestedRanges.forEach(r => {
        response += `- ${r.from}-${r.to} (${r.available} available)\n`;
      });
      response += '\n';
    }

    if (suggestions.patterns.length > 0) {
      response += `Patterns:\n`;
      suggestions.patterns.forEach(p => {
        response += `- ${p.pattern}: ${p.example}\n`;
      });
      response += '\n';
    }

    if (suggestions.recentlyUsed.length > 0) {
      response += `Recently used: ${suggestions.recentlyUsed.join(', ')}`;
    }

    return {
      content: [{ type: "text", text: response }]
    };
  }

  private async handleGetAssignmentHistory(args: GetAssignmentHistoryArgs): Promise<ToolCallResponse> {
    const app = args.appPath ? await this.getAppFromPath(args.appPath) : undefined;

    // Get from both assignment manager and persistence
    const history = this.assignmentManager.getHistory(app || undefined, args.objectType as ALObjectType | undefined, args.limit);
    const persistedHistory = this.configPersistence.getAssignmentHistory(
      app?.appId,
      args.objectType,
      args.limit
    );

    // Combine and deduplicate
    const combined = [...history, ...persistedHistory.map(h => ({
      timestamp: h.timestamp,
      app: app || ({ appId: h.appId } as WorkspaceApp),
      objectType: h.objectType as ALObjectType,
      ids: h.ids,
      description: h.description
    }))];

    // Sort by timestamp and limit
    const sorted = combined
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, args.limit || 50);

    if (sorted.length === 0) {
      return {
        content: [{ type: "text", text: "No assignment history found" }]
      };
    }

    const historyText = sorted.map(h => {
      const date = new Date(h.timestamp).toLocaleString();
      const ids = h.ids.slice(0, 5).join(', ') + (h.ids.length > 5 ? '...' : '');
      return `[${date}] ${h.objectType}: ${ids} ${h.description ? `(${h.description})` : ''}`;
    }).join('\n');

    return {
      content: [{
        type: "text",
        text: `📜 Assignment History:\n\n${historyText}`
      }]
    };
  }

  // Configuration Management handlers

  private async handleSavePreferences(args: SavePreferencesArgs): Promise<ToolCallResponse> {
    this.configPersistence.savePreferences(args.preferences);

    // Apply preferences
    if (args.preferences.logLevel) {
      this.logger.setLevel(args.preferences.logLevel);
    }

    return {
      content: [{
        type: "text",
        text: "✅ Preferences saved successfully"
      }]
    };
  }

  private async handleGetPreferences(_args: GetPreferencesArgs): Promise<ToolCallResponse> {
    const preferences = this.configPersistence.getPreferences();

    return {
      content: [{
        type: "text",
        text: JSON.stringify(preferences, null, 2)
      }]
    };
  }

  private async handleExportConfig(_args: ExportConfigArgs): Promise<ToolCallResponse> {
    const config = this.configPersistence.exportConfig();

    return {
      content: [{
        type: "text",
        text: config
      }]
    };
  }

  private async handleImportConfig(args: ImportConfigArgs): Promise<ToolCallResponse> {
    const success = this.configPersistence.importConfig(args.config);

    if (success) {
      // Restore configuration
      this.restoreConfiguration();

      return {
        content: [{
          type: "text",
          text: "✅ Configuration imported successfully"
        }]
      };
    }

    return {
      content: [{ type: "text", text: "Failed to import configuration" }],
      isError: true
    };
  }

  private async handleGetStatistics(_args: GetStatisticsArgs): Promise<ToolCallResponse> {
    const stats = this.configPersistence.getStatistics();

    const workspace = this.workspaceManager.getCurrentWorkspace();
    const assignmentStats = {
      pendingAssignments: this.assignmentManager.getPendingAssignments().size,
      sessionHistory: this.assignmentManager.getHistory().length
    };

    const combined = {
      ...stats,
      ...assignmentStats,
      currentWorkspace: workspace?.rootPath || 'None',
      activeApp: workspace?.activeApp?.name || 'None'
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(combined, null, 2)
      }]
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