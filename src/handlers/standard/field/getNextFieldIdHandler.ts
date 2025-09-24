import { ALObjectIdServer } from '../../../server';
import { DEFAULT_EXTENSION_RANGES } from '../../../lib/constants/ranges';

/**
 * Arguments for getting the next field ID
 * @interface
 */
export interface GetNextFieldIdArgs {
  /**
   * Optional path to the AL app
   * If not provided, uses the active app
   */
  appPath?: string;

  /**
   * The ID of the table to get field IDs for
   * @example 50100
   */
  tableId: number;

  /**
   * Whether this is for a table extension
   * Affects the ID range used
   * @default false
   */
  isExtension?: boolean;
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
 * Gets the next available field ID for a table or table extension
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for field ID generation
 * @param args.appPath - Optional path to the AL app
 * @param args.tableId - The ID of the table
 * @param args.isExtension - Whether this is for a table extension
 * @returns Promise resolving to the next available field ID
 * @throws {Error} When table ID is invalid or no IDs available
 *
 * @description
 * This handler determines the next available field ID for a table,
 * taking into account:
 * - Already consumed field IDs
 * - App's configured ranges (or default ranges)
 * - Whether it's a base table or extension
 *
 * Field ID rules:
 * - Base tables: Typically start from 1
 * - Extensions: Use app's assigned range (default: 50000-99999)
 *
 * The process:
 * 1. Validates the app exists and is authorized
 * 2. Determines the appropriate ID ranges
 * 3. Queries the field manager for next available ID
 * 4. Returns the suggested field ID
 *
 * @example
 * ```typescript
 * // For base table
 * const result = await handleGetNextFieldId(server, {
 *   tableId: 50100,
 *   isExtension: false
 * });
 * // Returns: { content: [{ type: "text", text: "Next available field ID for table 50100: 1" }] }
 *
 * // For table extension
 * const result = await handleGetNextFieldId(server, {
 *   tableId: 18, // Customer table
 *   isExtension: true,
 *   appPath: '/workspace/app'
 * });
 * // Returns: { content: [{ type: "text", text: "Next available field ID for table 18: 50000" }] }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleGetNextEnumValueId} for enum value IDs
 */
export async function handleGetNextFieldId(
  server: ALObjectIdServer,
  args: GetNextFieldIdArgs
): Promise<ToolCallResponse> {
  const app = await server.getAppFromPath(args.appPath);

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
  const fieldManager = server.fieldManager;

  const fieldId = await fieldManager.getNextFieldId(
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