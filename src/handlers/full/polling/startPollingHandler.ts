import { ALObjectIdServer } from '../../../server';
import { StartPollingArgs } from '../../../lib/types/ToolHandlerArgs';

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Starts the polling service for real-time synchronization
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for starting polling
 * @param args.interval - Polling interval in milliseconds (default: 30000)
 * @param args.features - Optional features configuration
 * @param args.features.consumption - Enable consumption tracking (default: true)
 * @param args.features.collisions - Enable collision detection (default: true)
 * @param args.features.pools - Enable pool synchronization (default: false)
 * @returns Promise resolving to polling start confirmation
 *
 * @description
 * This handler initiates the polling service that provides real-time
 * synchronization capabilities for multi-developer environments.
 *
 * Polling features:
 * - Real-time consumption updates
 * - Collision detection alerts
 * - Pool synchronization
 * - Configurable polling intervals
 * - Selective feature enablement
 *
 * The polling service provides:
 * 1. Automatic synchronization with backend
 * 2. Real-time collision notifications
 * 3. Consumption tracking updates
 * 4. Pool membership synchronization
 * 5. Configuration persistence
 *
 * Use cases:
 * - Multi-developer coordination
 * - Real-time conflict prevention
 * - Automatic synchronization
 * - Live consumption tracking
 * - Team collaboration
 *
 * @example
 * ```typescript
 * // Start with default settings
 * const result = await handleStartPolling(server, {});
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: "✅ Polling started with interval: 30000ms"
 * //   }]
 * // }
 *
 * // Start with custom interval and features
 * const result = await handleStartPolling(server, {
 *   interval: 15000, // 15 seconds
 *   features: {
 *     consumption: true,
 *     collisions: true,
 *     pools: true
 *   }
 * });
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: "✅ Polling started with interval: 15000ms"
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleStopPolling} for stopping the service
 * @see {@link handleGetPollingStatus} for status monitoring
 */
export async function handleStartPolling(
  server: ALObjectIdServer,
  args: StartPollingArgs
): Promise<ToolCallResponse> {
  const config = {
    enabled: true,
    interval: args.interval || 30000,
    checkConsumption: args.features?.consumption !== false,
    checkCollisions: args.features?.collisions !== false,
    checkPools: args.features?.pools || false
  };

  server.pollingManager.start(config);

  // Save to persistence
  server.configPersistence.savePollingConfig(config);

  return {
    content: [{
      type: "text",
      text: `✅ Polling started with interval: ${config.interval}ms`
    }]
  };
}