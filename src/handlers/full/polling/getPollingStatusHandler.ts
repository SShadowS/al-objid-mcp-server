import { ALObjectIdServer } from '../../../server';
import { GetPollingStatusArgs } from '../../../lib/types/ToolHandlerArgs';

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Gets the current status of the polling service
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for getting status (currently unused)
 * @returns Promise resolving to polling status information
 *
 * @description
 * This handler provides detailed status information about the polling service,
 * including configuration, runtime statistics, and health indicators.
 *
 * Status information includes:
 * - Service state (running/stopped)
 * - Current configuration
 * - Polling statistics
 * - Last sync timestamps
 * - Error information
 * - Feature enablement
 *
 * The status query process:
 * 1. Retrieves current service state
 * 2. Gathers runtime statistics
 * 3. Collects configuration details
 * 4. Formats comprehensive status
 * 5. Returns JSON status report
 *
 * Use cases:
 * - Service health monitoring
 * - Debugging synchronization issues
 * - Performance monitoring
 * - Configuration verification
 * - Troubleshooting
 *
 * @example
 * ```typescript
 * // Get current polling status
 * const result = await handleGetPollingStatus(server, {});
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: JSON.stringify({
 * //       isRunning: true,
 * //       interval: 30000,
 * //       lastPoll: "2024-01-15T10:30:00Z",
 * //       nextPoll: "2024-01-15T10:30:30Z",
 * //       features: {
 * //         consumption: true,
 * //         collisions: true,
 * //         pools: false
 * //       },
 * //       statistics: {
 * //         totalPolls: 145,
 * //         successfulPolls: 143,
 * //         failedPolls: 2,
 * //         lastError: null
 * //       }
 * //     }, null, 2)
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleStartPolling} for starting the service
 * @see {@link handleStopPolling} for stopping the service
 */
export async function handleGetPollingStatus(
  server: ALObjectIdServer,
  _args: GetPollingStatusArgs
): Promise<ToolCallResponse> {
  const status = server.pollingManager.getStatus();

  return {
    content: [{
      type: "text",
      text: JSON.stringify(status, null, 2)
    }]
  };
}