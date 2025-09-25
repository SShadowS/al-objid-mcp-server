import { ALObjectIdServer } from '../../../server';
import { GetAssignmentHistoryArgs } from '../../../lib/types/ToolHandlerArgs';
import { ALObjectType } from '../../../lib/types/ALObjectType';
import { WorkspaceApp } from '../../../lib/workspace/WorkspaceManager';

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Retrieves the history of ID assignments for auditing and tracking
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for retrieving history
 * @param args.appPath - Optional path to filter history for specific app
 * @param args.objectType - Optional object type to filter history
 * @param args.limit - Maximum number of entries to retrieve (default: 50)
 * @returns Promise resolving to assignment history
 *
 * @description
 * This handler provides access to the complete assignment history,
 * combining both session history and persisted history for comprehensive tracking.
 *
 * History tracking features:
 * - Chronological listing of all ID assignments
 * - Filtering by app and/or object type
 * - Description and metadata for each assignment
 * - Timestamp tracking for audit purposes
 * - Deduplication of combined sources
 *
 * Use cases:
 * - Audit ID assignments over time
 * - Track who assigned which IDs when
 * - Review assignment patterns
 * - Debug ID conflicts
 * - Generate assignment reports
 *
 * The history retrieval process:
 * 1. Fetches session history from assignment manager
 * 2. Retrieves persisted history from configuration
 * 3. Combines and deduplicates entries
 * 4. Sorts chronologically (newest first)
 * 5. Applies filtering and limit
 *
 * @example
 * ```typescript
 * // Get all recent assignments
 * const result = await handleGetAssignmentHistory(server, {
 *   limit: 20
 * });
 * // Returns:
 * // {
 * //   content: [{
 * //     type: "text",
 * //     text: "📜 Assignment History:\n\n" +
 * //           "[2024-01-15 10:30:00] table: 50100, 50101, 50102 (Customer tables)\n" +
 * //           "[2024-01-15 10:25:00] page: 50100, 50101 (Customer pages)\n" +
 * //           "[2024-01-15 10:20:00] codeunit: 50100 (Customer management)"
 * //   }]
 * // }
 *
 * // Get history for specific object type
 * const result = await handleGetAssignmentHistory(server, {
 *   objectType: 'table',
 *   limit: 10
 * });
 * // Returns only table assignments
 *
 * // Get history for specific app
 * const result = await handleGetAssignmentHistory(server, {
 *   appPath: '/workspace/app',
 *   limit: 30
 * });
 * // Returns assignments for the specified app only
 * ```
 *
 * @since 1.0.0
 * @see {@link handleAssignIds} for creating new assignments
 * @see {@link handleGetStatistics} for aggregated statistics
 */
export async function handleGetAssignmentHistory(
  server: ALObjectIdServer,
  args: GetAssignmentHistoryArgs
): Promise<ToolCallResponse> {
  const app = args.appPath ? await server.getAppFromPath(args.appPath) : undefined;

  // Get from both assignment manager and persistence
  const history = server.assignmentManager.getHistory(app || undefined, args.objectType as ALObjectType | undefined, args.limit);
  const persistedHistory = server.configPersistence.getAssignmentHistory(
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