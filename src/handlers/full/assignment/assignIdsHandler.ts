import { ALObjectIdServer } from '../../../server';
import { AssignIdsArgs } from '../../../lib/types/ToolHandlerArgs';
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
 * Interactively assigns object IDs with comprehensive collision checking and alternative suggestions
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for ID assignment
 * @param args.appPath - Optional path to the AL app
 * @param args.objectType - Type of AL object to assign IDs for
 * @param args.count - Number of IDs to assign (default: 1)
 * @param args.ranges - Optional specific ranges to search within
 * @param args.description - Description of the assignment for history tracking
 * @param args.checkCollisions - Whether to check for collisions (default: true)
 * @param args.suggestAlternatives - Whether to suggest alternatives on collision (default: true)
 * @returns Promise resolving to assignment results with IDs and any collision information
 * @throws {Error} When no IDs are available or app is not authorized
 *
 * @description
 * This handler performs intelligent ID assignment with the following features:
 * - Collision detection across multiple apps in the workspace
 * - Smart alternative suggestions when collisions occur
 * - Assignment history tracking for audit purposes
 * - Range-aware assignment respecting configuration
 * - Backend synchronization for multi-developer scenarios
 *
 * The assignment process:
 * 1. Validates the app and authorization
 * 2. Determines available ranges based on configuration
 * 3. Checks for collisions with other apps
 * 4. Suggests alternatives if collisions found
 * 5. Records assignment in history
 * 6. Syncs with backend if online
 *
 * @example
 * ```typescript
 * // Simple assignment
 * const result = await handleAssignIds(server, {
 *   objectType: 'table',
 *   count: 5,
 *   description: 'Customer management tables'
 * });
 * // Returns: { content: [{ type: "text", text: "✅ Assigned 5 ID(s): 50100, 50101, 50102, 50103, 50104" }] }
 *
 * // Assignment with specific ranges and collision handling
 * const result = await handleAssignIds(server, {
 *   appPath: '/workspace/app',
 *   objectType: 'page',
 *   count: 3,
 *   ranges: [{ from: 50100, to: 50199 }],
 *   description: 'Customer list pages',
 *   checkCollisions: true,
 *   suggestAlternatives: true
 * });
 * // Returns with collision info:
 * // {
 * //   content: [{
 * //     type: "text",
 * //     text: "✅ Assigned 3 ID(s): 50100, 50101, 50102\n" +
 * //           "⚠️ Collisions detected:\n" +
 * //           "- ID 50100 conflicts with App1\n" +
 * //           "💡 Alternative IDs: 50103, 50104, 50105"
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleBatchAssign} for assigning multiple object types
 * @see {@link handleCheckCollision} for collision detection details
 */
export async function handleAssignIds(
  server: ALObjectIdServer,
  args: AssignIdsArgs
): Promise<ToolCallResponse> {
  const app = await server.getAppFromPath(args.appPath);
  if (!app) {
    return {
      content: [{ type: "text", text: "No AL app found" }],
      isError: true
    };
  }

  const result = await server.assignmentManager.assignIds(app, {
    objectType: args.objectType as ALObjectType,
    count: args.count,
    ranges: args.ranges,
    description: args.description,
    checkCollisions: args.checkCollisions !== false,
    suggestAlternatives: args.suggestAlternatives !== false
  });

  if (result.success) {
    // Save to persistence
    server.configPersistence.addAssignmentHistory(
      app.appId,
      args.objectType,
      result.ids,
      args.description
    );

    let response = `✅ Assigned ${result.ids.length} ID(s): ${result.ids.join(', ')}`;

    if (result.collisions && result.collisions.length > 0) {
      response += `\n\n⚠️ Collisions detected:\n${result.collisions.map((c: { id: number; conflictingApps: string[] }) =>
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