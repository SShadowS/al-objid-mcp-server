import { ALObjectIdServer } from '../../../server';
import { BatchAssignArgs } from '../../../lib/types/ToolHandlerArgs';
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
 * Batch assigns object IDs for multiple object types in a single operation
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for batch assignment
 * @param args.appPath - Optional path to the AL app
 * @param args.assignments - Array of assignment specifications for different object types
 * @returns Promise resolving to batch assignment results
 * @throws {Error} When app is not found or not authorized
 *
 * @description
 * This handler processes multiple ID assignments in a single operation,
 * providing efficiency for bulk ID allocation scenarios.
 *
 * Features:
 * - Processes multiple object types in one call
 * - Each assignment can have different parameters
 * - Atomic operation - all assignments succeed or fail together
 * - Provides summary of all assignments
 * - Maintains assignment history for each type
 *
 * The batch process:
 * 1. Validates app authorization
 * 2. Processes each assignment request sequentially
 * 3. Aggregates results for all assignments
 * 4. Returns comprehensive summary
 *
 * @example
 * ```typescript
 * const result = await handleBatchAssign(server, {
 *   appPath: '/workspace/app',
 *   assignments: [
 *     {
 *       objectType: 'table',
 *       count: 3,
 *       description: 'Customer tables'
 *     },
 *     {
 *       objectType: 'page',
 *       count: 5,
 *       description: 'Customer pages',
 *       ranges: [{ from: 50100, to: 50199 }]
 *     },
 *     {
 *       objectType: 'codeunit',
 *       count: 2,
 *       description: 'Customer management codeunits'
 *     }
 *   ]
 * });
 * // Returns:
 * // {
 * //   content: [{
 * //     type: "text",
 * //     text: "Batch assignment results:\n\n" +
 * //           "✅ table: 50100, 50101, 50102\n" +
 * //           "✅ page: 50103, 50104, 50105, 50106, 50107\n" +
 * //           "✅ codeunit: 50100, 50101"
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleAssignIds} for single object type assignment
 * @see {@link handleReserveRange} for range reservation
 */
export async function handleBatchAssign(
  server: ALObjectIdServer,
  args: BatchAssignArgs
): Promise<ToolCallResponse> {
  const app = await server.getAppFromPath(args.appPath);
  if (!app) {
    return {
      content: [{ type: "text", text: "No AL app found" }],
      isError: true
    };
  }

  const results = await server.assignmentManager.batchAssign(app, args.assignments.map(a => ({
    ...a,
    objectType: a.objectType as ALObjectType
  })));

  const summary = results.map((r: { success: boolean; objectType: string; ids: number[] }) => {
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