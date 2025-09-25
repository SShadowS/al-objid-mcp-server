import { ALObjectIdServer } from '../../../server';

/**
 * Arguments for syncing object IDs
 * @interface
 */
export interface SyncObjectIdsArgs {
  /**
   * Path to the AL app
   * Can be absolute or relative to the workspace
   */
  appPath?: string;

  /**
   * Object IDs by type to sync
   * Keys are object type names, values are arrays of consumed IDs
   * @example { "table": [50100, 50101], "page": [50100] }
   */
  ids: Record<string, number[]>;

  /**
   * Whether to merge with existing IDs (true) or replace them (false)
   * @default false
   * @deprecated Use `mode` parameter instead
   */
  merge?: boolean;

  /**
   * Sync mode: 'merge' (UPDATE/PATCH) or 'replace' (REPLACE/POST)
   * Takes precedence over `merge` parameter
   * @default 'merge'
   */
  mode?: 'merge' | 'replace' | 'UPDATE' | 'REPLACE';
}

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Synchronizes consumed object IDs with the backend service
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for syncing object IDs
 * @param args.appPath - Path to the AL app
 * @param args.ids - Object IDs by type to sync
 * @param args.merge - Whether to merge or replace (deprecated)
 * @param args.mode - Sync mode: merge or replace
 * @returns Promise resolving to the sync result
 * @throws {Error} When app is not found or not authorized
 *
 * @description
 * This handler synchronizes the app's consumed object IDs with the backend,
 * ensuring consistency across team members and preventing ID conflicts.
 *
 * Sync modes:
 * - **Merge mode** (UPDATE/PATCH): Adds new IDs to existing consumption
 * - **Replace mode** (REPLACE/POST): Replaces all consumption data
 *
 * The sync process:
 * 1. Validates the app exists and is authorized
 * 2. Uses pool ID if the app is part of a pool
 * 3. Sends consumption data to backend
 * 4. Records sync in assignment history
 * 5. Returns confirmation with mode used
 *
 * @example
 * ```typescript
 * // Replace mode (default)
 * const result = await handleSyncObjectIds(server, {
 *   appPath: '/workspace/app',
 *   ids: {
 *     table: [50100, 50101, 50102],
 *     page: [50100, 50101],
 *     codeunit: [50100]
 *   }
 * });
 * // Returns: { content: [{ type: "text", text: "✅ Successfully synced object IDs for app \"MyApp\" (REPLACE mode)" }] }
 *
 * // Merge mode
 * const result = await handleSyncObjectIds(server, {
 *   appPath: '/workspace/app',
 *   ids: {
 *     table: [50103, 50104]
 *   },
 *   mode: 'merge'
 * });
 * // Returns: { content: [{ type: "text", text: "✅ Successfully synced object IDs for app \"MyApp\" (MERGE mode)" }] }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleGetConsumptionReport} for retrieving consumption data
 */
export async function handleSyncObjectIds(
  server: ALObjectIdServer,
  args: SyncObjectIdsArgs
): Promise<ToolCallResponse> {
  const app = await server.getAppFromPath(args.appPath);

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
  const workspace = server.workspaceManager;
  const appId = workspace.getPoolIdFromAppIdIfAvailable(app.appId);

  // Determine sync mode with proper defaults
  let mode: 'merge' | 'replace' = 'merge'; // Default to merge for safety

  if (args.mode) {
    // Normalize mode values
    if (args.mode === 'UPDATE' || args.mode === 'merge') {
      mode = 'merge';
    } else if (args.mode === 'REPLACE' || args.mode === 'replace') {
      mode = 'replace';
    }
  } else if (args.merge !== undefined) {
    // Fall back to deprecated merge parameter if mode not specified
    mode = args.merge ? 'merge' : 'replace';
  }

  const backend = server.backendService;
  const result = await backend.syncIds({
    appId,
    authKey: app.authKey,
    ids: args.ids,
    mode
  });

  if (result) {
    // Record in persistence
    const persistence = server.configPersistence;
    for (const [objectType, ids] of Object.entries(args.ids)) {
      if (Array.isArray(ids)) {
        persistence.addAssignmentHistory(
          app.appId,
          objectType,
          ids,
          `${mode === 'merge' ? 'Merge' : 'Replace'} sync`
        );
      }
    }

    return {
      content: [{
        type: "text",
        text: `✅ Successfully synced object IDs for app "${app.name}" (${mode === 'merge' ? 'MERGE' : 'REPLACE'} mode)`
      }]
    };
  }

  return {
    content: [{ type: "text", text: "Failed to sync object IDs" }],
    isError: true
  };
}