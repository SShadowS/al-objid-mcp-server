import { ALObjectIdServer } from '../../../server';
import { CheckRangeOverlapsArgs } from '../../../lib/types/ToolHandlerArgs';

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Checks for ID range overlaps between different apps in the workspace
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for range overlap checking (currently unused)
 * @returns Promise resolving to range overlap detection results
 *
 * @description
 * This handler performs comprehensive analysis of ID range configurations
 * across all apps in the workspace to identify potential conflicts.
 *
 * Range overlap detection features:
 * - Scans all app configurations
 * - Identifies overlapping ID ranges
 * - Reports specific overlap details
 * - Provides conflict resolution guidance
 * - Helps prevent future collisions
 *
 * The detection process:
 * 1. Loads all app configurations in workspace
 * 2. Extracts ID ranges from each app
 * 3. Compares ranges for overlaps
 * 4. Reports any overlaps found
 * 5. Suggests resolution strategies
 *
 * Use cases:
 * - Workspace configuration validation
 * - Multi-app coordination
 * - Pre-deployment verification
 * - Range allocation planning
 * - Conflict prevention
 *
 * @example
 * ```typescript
 * // Check for any range overlaps in the workspace
 * const result = await handleCheckRangeOverlaps(server, {});
 *
 * // Returns if overlaps found:
 * // {
 * //   content: [{
 * //     type: "text",
 * //     text: "⚠️ Range overlaps detected:\n\n" +
 * //           "- CustomerApp (50100-50199) overlaps with VendorApp (50150-50250)\n" +
 * //           "- InventoryApp (60000-60999) overlaps with WarehouseApp (60500-61000)"
 * //   }]
 * // }
 *
 * // Returns if no overlaps:
 * // {
 * //   content: [{
 * //     type: "text",
 * //     text: "✅ No range overlaps detected between apps"
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleCheckCollision} for individual ID collision checking
 * @see {@link handleReserveRange} for range reservation
 */
export async function handleCheckRangeOverlaps(
  server: ALObjectIdServer,
  _args: CheckRangeOverlapsArgs
): Promise<ToolCallResponse> {
  const overlaps = await server.collisionDetector.checkRangeOverlaps();

  if (overlaps.length === 0) {
    return {
      content: [{
        type: "text",
        text: "✅ No range overlaps detected between apps"
      }]
    };
  }

  const overlapList = overlaps
    .map((o: { message: string }) => `- ${o.message}`)
    .join('\n');

  return {
    content: [{
      type: "text",
      text: `⚠️ Range overlaps detected:\n\n${overlapList}`
    }]
  };
}