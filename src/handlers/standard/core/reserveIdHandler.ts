import { ALObjectIdServer } from '../../../server';
import { ALObjectType } from '../../../lib/types/ALObjectType';
import { DEFAULT_EXTENSION_RANGES } from '../../../lib/constants/ranges';

/**
 * Arguments for reserving a specific ID
 * @interface
 */
export interface ReserveIdArgs {
  /**
   * Type of AL object or 'field' for field IDs
   * @example "table", "page", "field", "enum"
   */
  objectType: string;

  /**
   * The specific ID to reserve
   * Must be within the app's allowed ranges
   * @example 50100
   */
  id: number;

  /**
   * For field IDs: the table ID. For enum values: the enum ID
   * Required when objectType is "field" or reserving enum values
   * @example 50100
   */
  parentObjectId?: number;

  /**
   * Whether this is for a table/enum extension
   * Affects the ID range used
   * @default false
   */
  isExtension?: boolean;

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
 * Reserves a specific ID for use, preventing others from using it
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for ID reservation
 * @param args.objectType - Type of AL object or 'field' for field IDs
 * @param args.id - The specific ID to reserve
 * @param args.parentObjectId - For field IDs: the table ID. For enum values: the enum ID
 * @param args.isExtension - Whether this is for a table/enum extension
 * @param args.appPath - Path to the AL app
 * @returns Promise resolving to the reservation result
 * @throws {Error} When ID is outside allowed ranges or already in use
 *
 * @description
 * This handler reserves a specific ID to prevent conflicts and ensure
 * the ID is available when needed. It supports:
 * - Standard object IDs (table, page, codeunit, etc.)
 * - Field IDs within tables
 * - Enum value IDs within enums
 *
 * The reservation process:
 * 1. Validates the app exists and is authorized
 * 2. Checks if the ID is within allowed ranges
 * 3. Attempts to reserve the specific ID
 * 4. Records the reservation for tracking
 * 5. Returns success or suggests alternatives if taken
 *
 * @example
 * ```typescript
 * // Reserve a table ID
 * const result = await handleReserveId(server, {
 *   objectType: 'table',
 *   id: 50100,
 *   appPath: '/workspace/app'
 * });
 * // Returns: { content: [{ type: "text", text: "✓ Successfully reserved table ID: 50100" }] }
 *
 * // Reserve a field ID
 * const result = await handleReserveId(server, {
 *   objectType: 'field',
 *   id: 50000,
 *   parentObjectId: 50100, // Table ID
 *   appPath: '/workspace/app'
 * });
 * // Returns: { content: [{ type: "text", text: "✓ Reserved field ID 50000 for table 50100" }] }
 *
 * // Failed reservation (already taken)
 * const result = await handleReserveId(server, {
 *   objectType: 'page',
 *   id: 50100
 * });
 * // Returns: {
 * //   content: [{ type: "text", text: "✗ ID 50100 is already taken. Next available: 50101\nUse 'get-next-id' to find another available ID." }],
 * //   isError: true
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleGetNextId} for finding available IDs
 */
export async function handleReserveId(
  server: ALObjectIdServer,
  args: ReserveIdArgs
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
  const assignment = server.assignmentManager;

  // Handle field/enum value reservation
  if (args.parentObjectId) {
    const ranges = app.ranges || DEFAULT_EXTENSION_RANGES;

    if (args.objectType === 'field' || args.objectType === 'table') {
      // Reserve field ID
      const success = await fieldManager.reserveFieldId(
        app.appId,
        app.authKey,
        args.parentObjectId,
        args.id,
        ranges
      );

      if (success) {
        // Use storeAssignment for real-time tracking without overwriting consumption
        const objectType = `table_${args.parentObjectId}`;
        const poolId = workspace.getPoolIdFromAppIdIfAvailable(app.appId);
        await backend.storeAssignment(
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
      const success = await fieldManager.reserveEnumValueId(
        app.appId,
        app.authKey,
        args.parentObjectId,
        args.id,
        ranges
      );

      if (success) {
        // Use storeAssignment for real-time tracking without overwriting consumption
        const objectType = `enum_${args.parentObjectId}`;
        const poolId = workspace.getPoolIdFromAppIdIfAvailable(app.appId);
        await backend.storeAssignment(
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
  const appId = workspace.getPoolIdFromAppIdIfAvailable(app.appId);

  // Validate ID is within allowed ranges
  const inRange = ranges.some((r: { from: number; to: number }) => args.id >= r.from && args.id <= r.to);
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
  const result = await backend.getNext(request, true);

  if (result && result.available) {
    const reservedId = Array.isArray(result.id) ? result.id[0] : result.id;

    if (reservedId === args.id) {
      // Successfully reserved the requested ID
      // Track the assignment
      await assignment.assignIds(app, {
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