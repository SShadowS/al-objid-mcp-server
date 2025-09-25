import { ALObjectIdServer } from '../../../server';
import { GetPreferencesArgs } from '../../../lib/types/ToolHandlerArgs';

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Retrieves the current user preferences
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for getting preferences (currently unused)
 * @returns Promise resolving to current preferences as JSON
 *
 * @description
 * This handler retrieves all configured user preferences from
 * the persistence layer and returns them as formatted JSON.
 *
 * Retrieved preferences include:
 * - Log level settings
 * - Default ID ranges
 * - Synchronization preferences
 * - Collision handling settings
 * - Polling configuration
 * - UI preferences
 *
 * The retrieval process:
 * 1. Loads preferences from persistence
 * 2. Merges with defaults for missing values
 * 3. Formats as readable JSON
 * 4. Returns complete preference set
 *
 * Use cases:
 * - Preference backup
 * - Configuration review
 * - Debugging settings
 * - Preference sharing
 * - Migration preparation
 *
 * @example
 * ```typescript
 * // Get current preferences
 * const result = await handleGetPreferences(server, {});
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: JSON.stringify({
 * //       logLevel: "info",
 * //       autoSync: true,
 * //       defaultRanges: [
 * //         { from: 50000, to: 50999 }
 * //       ],
 * //       collisionWarnings: "always",
 * //       pollingInterval: 30000
 * //     }, null, 2)
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleSavePreferences} for updating preferences
 * @see {@link handleExportConfig} for full configuration export
 */
export async function handleGetPreferences(
  server: ALObjectIdServer,
  _args: GetPreferencesArgs
): Promise<ToolCallResponse> {
  const preferences = server.configPersistence.getPreferences();

  return {
    content: [{
      type: "text",
      text: JSON.stringify(preferences, null, 2)
    }]
  };
}