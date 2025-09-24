import { ALObjectIdServer } from '../../../server';
import { CheckCollisionArgs } from '../../../lib/types/ToolHandlerArgs';
import { ALObjectType } from '../../../lib/types/ALObjectType';

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Checks for ID collisions across all apps in the workspace
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for collision checking
 * @param args.appPath - Optional path to the AL app
 * @param args.objectType - Type of AL object to check
 * @param args.id - The specific ID to check for collisions
 * @returns Promise resolving to collision detection results
 * @throws {Error} When app is not found
 *
 * @description
 * This handler performs comprehensive collision detection to identify
 * potential ID conflicts across multiple apps in the workspace.
 *
 * Collision detection features:
 * - Cross-app collision checking
 * - Real-time collision detection
 * - Detailed conflict reporting
 * - App-level conflict resolution guidance
 *
 * The detection process:
 * 1. Validates the app context
 * 2. Scans all apps in workspace
 * 3. Checks for ID usage in each app
 * 4. Reports any conflicts found
 * 5. Provides conflict resolution guidance
 *
 * Use cases:
 * - Pre-assignment collision checking
 * - Conflict resolution planning
 * - Multi-app workspace coordination
 * - ID allocation verification
 *
 * @example
 * ```typescript
 * // Check if table ID 50100 is already in use
 * const result = await handleCheckCollision(server, {
 *   objectType: 'table',
 *   id: 50100,
 *   appPath: '/workspace/app'
 * });
 * // Returns if collision found:
 * // {
 * //   content: [{
 * //     type: "text",
 * //     text: "⚠️ Collision detected!\n\n" +
 * //           "Table ID 50100 is already in use\n\n" +
 * //           "Conflicting apps:\n" +
 * //           "- CustomerApp (/workspace/CustomerApp)\n" +
 * //           "- VendorApp (/workspace/VendorApp)"
 * //   }]
 * // }
 *
 * // Check page ID with no collision
 * const result = await handleCheckCollision(server, {
 *   objectType: 'page',
 *   id: 50200
 * });
 * // Returns:
 * // {
 * //   content: [{
 * //     type: "text",
 * //     text: "✅ No collision detected for page ID 50200"
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleCheckRangeOverlaps} for range collision checking
 * @see {@link handleAssignIds} for collision-aware assignment
 */
export async function handleCheckCollision(
  server: ALObjectIdServer,
  args: CheckCollisionArgs
): Promise<ToolCallResponse> {
  const app = await server.getAppFromPath(args.appPath);
  if (!app) {
    return {
      content: [{ type: "text", text: "No AL app found" }],
      isError: true
    };
  }

  const collision = await server.collisionDetector.checkCollision(
    args.objectType as ALObjectType,
    args.id,
    app
  );

  if (collision) {
    const conflictingApps = collision.apps
      .map((a: { appName: string; appPath: string }) => `- ${a.appName} (${a.appPath})`)
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