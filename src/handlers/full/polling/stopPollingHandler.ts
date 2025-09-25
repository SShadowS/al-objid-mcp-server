import { ALObjectIdServer } from '../../../server';
import { StopPollingArgs } from '../../../lib/types/ToolHandlerArgs';

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Stops the polling service
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for stopping polling (currently unused)
 * @returns Promise resolving to polling stop confirmation
 *
 * @description
 * This handler stops the active polling service, discontinuing
 * real-time synchronization with the backend.
 *
 * Stop operation effects:
 * - Immediately stops all polling activities
 * - Cancels pending synchronization requests
 * - Preserves current configuration
 * - Updates persistence state
 * - Clears active timers
 *
 * The stop process:
 * 1. Signals polling service to stop
 * 2. Cancels any in-flight requests
 * 3. Updates configuration persistence
 * 4. Cleans up resources
 * 5. Returns confirmation
 *
 * Use cases:
 * - Reducing network traffic
 * - Offline development mode
 * - Resource conservation
 * - Debugging isolation
 * - Controlled synchronization
 *
 * @example
 * ```typescript
 * // Stop active polling
 * const result = await handleStopPolling(server, {});
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: "✅ Polling stopped"
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleStartPolling} for starting the service
 * @see {@link handleGetPollingStatus} for status monitoring
 */
export async function handleStopPolling(
  server: ALObjectIdServer,
  _args: StopPollingArgs
): Promise<ToolCallResponse> {
  server.pollingManager.stop();

  // Update persistence
  const config = server.configPersistence.getPollingConfig();
  config.enabled = false;
  server.configPersistence.savePollingConfig(config);

  return {
    content: [{
      type: "text",
      text: "✅ Polling stopped"
    }]
  };
}