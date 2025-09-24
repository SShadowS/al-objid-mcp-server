import { ALObjectIdServer } from '../../../server';
import { ALObjectType } from '../../../lib/types/ALObjectType';
import { DEFAULT_EXTENSION_RANGES } from '../../../lib/constants/ranges';

/**
 * Arguments for getting the next available ID
 * @interface
 */
export interface GetNextObjectIdArgs {
  /**
   * Type of AL object or 'field' for field IDs
   * @example "table", "page", "report", "codeunit", "query", "xmlport", "enum", "field"
   */
  objectType: string;

  /**
   * For field IDs: the table ID. For enum values: the enum ID
   * Required when objectType is "field" or getting enum values
   */
  parentObjectId?: number;

  /**
   * Whether this is for a table/enum extension
   * Affects the ID range used
   * @default false
   */
  isExtension?: boolean;

  /**
   * Optional custom ranges to search within
   * If not provided, uses app's configured ranges or defaults
   */
  ranges?: Array<{ from: number; to: number }>;

  /**
   * Path to the AL app (optional, uses active app if not provided)
   */
  appPath?: string;
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
 * Gets the next available ID for objects or fields without reserving it
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for getting the next ID
 * @param args.objectType - Type of AL object or 'field' for field IDs
 * @param args.parentObjectId - For field IDs: the table ID. For enum values: the enum ID
 * @param args.isExtension - Whether this is for a table/enum extension
 * @param args.ranges - Optional custom ranges to search within
 * @param args.appPath - Path to the AL app
 * @returns Promise resolving to the next available ID
 * @throws {Error} When no IDs are available or app is not authorized
 *
 * @description
 * This handler queries for the next available ID without reserving it.
 * It supports:
 * - Standard object IDs (table, page, codeunit, etc.)
 * - Field IDs within tables
 * - Enum value IDs within enums
 * - Collision detection to warn about potential conflicts
 *
 * The query process:
 * 1. Validates the app exists and is authorized
 * 2. Determines the appropriate ID ranges
 * 3. Queries backend for next available ID (without committing)
 * 4. Checks for potential collisions with other apps
 * 5. Returns the suggested ID with warnings if needed
 *
 * Important: This only suggests an ID - use 'reserve-id' to claim it.
 *
 * @example
 * ```typescript
 * // Get next table ID
 * const result = await handleGetNextId(server, {
 *   objectType: 'table',
 *   appPath: '/workspace/app'
 * });
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: "Next available table ID: 50100\nUse 'reserve-id' to claim this ID."
 * //   }]
 * // }
 *
 * // Get next field ID
 * const result = await handleGetNextId(server, {
 *   objectType: 'field',
 *   parentObjectId: 50100,
 *   appPath: '/workspace/app'
 * });
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: "Next available field ID for table 50100: 1\nUse 'reserve-id' to claim this ID."
 * //   }]
 * // }
 *
 * // With collision warning
 * const result = await handleGetNextId(server, {
 *   objectType: 'page',
 *   ranges: [{ from: 50100, to: 50199 }]
 * });
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: "Next available page ID: 50100\n⚠️ Warning: Potential collision with OtherApp\nUse 'reserve-id' to claim this ID."
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleReserveId} for reserving the suggested ID
 * @see {@link handleGetNextFieldId} for field-specific queries
 * @see {@link handleGetNextEnumValueId} for enum value queries
 */
export async function handleGetNextId(
  server: ALObjectIdServer,
  args: GetNextObjectIdArgs
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

  const workspace = server.workspaceManager;
  const backend = server.backendService;
  const fieldManager = server.fieldManager;
  const collision = server.collisionDetector;

  // Handle field/enum value requests
  if (args.parentObjectId) {
    const ranges = args.ranges || app.ranges || DEFAULT_EXTENSION_RANGES;

    if (args.objectType === 'field' || args.objectType === 'table') {
      // Get field ID
      const fieldId = await fieldManager.getNextFieldId(
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
      const enumValueId = await fieldManager.getNextEnumValueId(
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
  const appId = workspace.getPoolIdFromAppIdIfAvailable(app.appId);

  const request = {
    appId,
    type: objectType,
    ranges,
    authKey: app.authKey,
    perRange: false
  };

  // Query without committing (GET request)
  const result = await backend.getNext(request, false);

  if (result && result.available) {
    // Handle both single ID and array of IDs
    const id = Array.isArray(result.id) ? result.id[0] : result.id;

    // Check for collisions
    const collisionResult = await collision.checkCollision(objectType, id, app);

    if (collisionResult) {
      return {
        content: [{
          type: "text",
          text: `Next available ${objectType} ID: ${id}\n⚠️ Warning: Potential collision with ${collisionResult.apps.map((a: { appName: string }) => a.appName).join(', ')}\nUse 'reserve-id' to claim this ID.`
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