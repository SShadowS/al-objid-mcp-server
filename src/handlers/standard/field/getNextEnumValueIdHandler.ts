import { ALObjectIdServer } from '../../../server';
import { DEFAULT_EXTENSION_RANGES } from '../../../lib/constants/ranges';

/**
 * Arguments for getting the next enum value ID
 * @interface
 */
export interface GetNextEnumValueIdArgs {
  /**
   * Optional path to the AL app
   * If not provided, uses the active app
   */
  appPath?: string;

  /**
   * The ID of the enum to get value IDs for
   * @example 50100
   */
  enumId: number;

  /**
   * Whether this is for an enum extension
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
 * Gets the next available enum value ID for an enum or enum extension
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for enum value ID generation
 * @param args.appPath - Optional path to the AL app
 * @param args.enumId - The ID of the enum
 * @param args.isExtension - Whether this is for an enum extension
 * @returns Promise resolving to the next available enum value ID
 * @throws {Error} When enum ID is invalid or no IDs available
 *
 * @description
 * This handler determines the next available value ID for an enum,
 * taking into account:
 * - Already consumed enum value IDs
 * - App's configured ranges (or default ranges)
 * - Whether it's a base enum or extension
 *
 * Enum value ID rules:
 * - Base enums: Typically start from 0
 * - Extensions: Use app's assigned range (default: 50000-99999)
 * - Values can be any non-negative integer
 *
 * The process:
 * 1. Validates the app exists and is authorized
 * 2. Determines the appropriate ID ranges
 * 3. Queries the field manager for next available ID
 * 4. Returns the suggested enum value ID
 *
 * @example
 * ```typescript
 * // For base enum
 * const result = await handleGetNextEnumValueId(server, {
 *   enumId: 50100,
 *   isExtension: false
 * });
 * // Returns: { content: [{ type: "text", text: "Next available enum value ID for enum 50100: 0" }] }
 *
 * // For enum extension
 * const result = await handleGetNextEnumValueId(server, {
 *   enumId: 5, // Option enum
 *   isExtension: true,
 *   appPath: '/workspace/app'
 * });
 * // Returns: { content: [{ type: "text", text: "Next available enum value ID for enum 5: 50000" }] }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleGetNextFieldId} for table field IDs
 */
export async function handleGetNextEnumValueId(
  server: ALObjectIdServer,
  args: GetNextEnumValueIdArgs
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

  const valueId = await fieldManager.getNextEnumValueId(
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