import { ALObjectIdServer } from '../../../server';
import { GetStatisticsArgs } from '../../../lib/types/ToolHandlerArgs';

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Retrieves comprehensive usage statistics and metrics
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for getting statistics (currently unused)
 * @returns Promise resolving to usage statistics as JSON
 *
 * @description
 * This handler provides detailed statistics about ID usage, assignment
 * patterns, and system performance metrics for analysis and optimization.
 *
 * Statistics categories:
 * - Assignment metrics (total, by type, by app)
 * - ID consumption patterns
 * - Collision statistics
 * - Session information
 * - Performance metrics
 * - Workspace statistics
 * - Historical trends
 *
 * The statistics gathering process:
 * 1. Collects persisted statistics
 * 2. Gathers session metrics
 * 3. Calculates derived values
 * 4. Formats comprehensive report
 * 5. Returns JSON statistics
 *
 * Use cases:
 * - Usage analysis
 * - Performance monitoring
 * - Capacity planning
 * - Optimization opportunities
 * - Reporting and auditing
 *
 * @example
 * ```typescript
 * // Get comprehensive statistics
 * const result = await handleGetStatistics(server, {});
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: JSON.stringify({
 * //       totalAssignments: 1543,
 * //       assignmentsByType: {
 * //         table: 450,
 * //         page: 623,
 * //         codeunit: 234,
 * //         query: 89,
 * //         report: 147
 * //       },
 * //       collisionCount: 12,
 * //       sessionStats: {
 * //         pendingAssignments: 3,
 * //         sessionHistory: 45
 * //       },
 * //       currentWorkspace: "/workspace/apps",
 * //       activeApp: "CustomerApp",
 * //       averageAssignmentSize: 3.2,
 * //       peakHour: "14:00",
 * //       lastSync: "2024-01-15T10:30:00Z"
 * //     }, null, 2)
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleGetAssignmentHistory} for detailed history
 * @see {@link handleGetPollingStatus} for polling statistics
 */
export async function handleGetStatistics(
  server: ALObjectIdServer,
  _args: GetStatisticsArgs
): Promise<ToolCallResponse> {
  const stats = server.configPersistence.getStatistics();

  const workspace = server.workspaceManager.getCurrentWorkspace();
  const assignmentStats = {
    pendingAssignments: server.assignmentManager.getPendingAssignments().size,
    sessionHistory: server.assignmentManager.getHistory().length
  };

  const combined = {
    ...stats,
    ...assignmentStats,
    currentWorkspace: workspace?.rootPath || 'None',
    activeApp: workspace?.activeApp?.name || 'None'
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify(combined, null, 2)
    }]
  };
}