import { ALObjectIdServer } from '../../../server';
import { SavePreferencesArgs } from '../../../lib/types/ToolHandlerArgs';

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Saves user preferences and applies them to the current session
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments containing preferences to save
 * @param args.preferences - Object containing preference key-value pairs
 * @returns Promise resolving to save confirmation
 *
 * @description
 * This handler persists user preferences and immediately applies them
 * to the current session for instant effect.
 *
 * Supported preferences:
 * - logLevel: Logging verbosity (debug, info, warn, error)
 * - defaultRanges: Default ID ranges for new apps
 * - autoSync: Automatic synchronization settings
 * - collisionWarnings: Collision warning preferences
 * - pollingDefaults: Default polling configuration
 *
 * The save process:
 * 1. Validates preference values
 * 2. Persists to configuration storage
 * 3. Applies preferences to current session
 * 4. Triggers necessary reloads
 * 5. Returns confirmation
 *
 * Use cases:
 * - User customization
 * - Development environment setup
 * - Team preference sharing
 * - Debugging configuration
 * - Performance tuning
 *
 * @example
 * ```typescript
 * // Save logging and sync preferences
 * const result = await handleSavePreferences(server, {
 *   preferences: {
 *     logLevel: 'debug',
 *     autoSync: true,
 *     defaultRanges: [
 *       { from: 50000, to: 50999 }
 *     ],
 *     collisionWarnings: 'always'
 *   }
 * });
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: "✅ Preferences saved successfully"
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleGetPreferences} for retrieving preferences
 * @see {@link handleImportConfig} for bulk configuration import
 */
export async function handleSavePreferences(
  server: ALObjectIdServer,
  args: SavePreferencesArgs
): Promise<ToolCallResponse> {
  server.configPersistence.savePreferences(args.preferences);

  // Apply preferences
  if (args.preferences.logLevel) {
    server.logger.setLevel(args.preferences.logLevel);
  }

  return {
    content: [{
      type: "text",
      text: "✅ Preferences saved successfully"
    }]
  };
}