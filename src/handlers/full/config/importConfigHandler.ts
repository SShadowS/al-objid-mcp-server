import { ALObjectIdServer } from '../../../server';
import { ImportConfigArgs } from '../../../lib/types/ToolHandlerArgs';

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Imports a configuration from JSON, replacing current settings
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments containing configuration to import
 * @param args.config - JSON string containing the configuration to import
 * @returns Promise resolving to import confirmation or error
 * @throws {Error} When configuration is invalid or incompatible
 *
 * @description
 * This handler imports a complete configuration from a JSON export,
 * replacing the current configuration with the imported settings.
 *
 * Import capabilities:
 * - Full configuration replacement
 * - Validation and compatibility checking
 * - Version migration support
 * - Automatic backup before import
 * - Rollback on failure
 *
 * The import process:
 * 1. Validates JSON structure
 * 2. Checks version compatibility
 * 3. Creates backup of current config
 * 4. Imports new configuration
 * 5. Applies settings to session
 * 6. Triggers necessary reloads
 *
 * Use cases:
 * - Configuration restoration
 * - Team settings deployment
 * - Environment setup
 * - Migration between systems
 * - Template application
 *
 * Safety features:
 * - Automatic backup before import
 * - Validation of critical settings
 * - Version compatibility checks
 * - Rollback on error
 *
 * @example
 * ```typescript
 * // Import configuration from export
 * const result = await handleImportConfig(server, {
 *   config: JSON.stringify({
 *     version: "1.0.0",
 *     preferences: {
 *       logLevel: "debug",
 *       autoSync: false
 *     },
 *     assignmentHistory: [...],
 *     appAuthorizations: [...]
 *   })
 * });
 * // Returns on success:
 * // {
 * //   content: [{
 * //     type: "text",
 * //     text: "✅ Configuration imported successfully"
 * //   }]
 * // }
 *
 * // Returns on failure:
 * // {
 * //   content: [{
 * //     type: "text",
 * //     text: "Failed to import configuration"
 * //   }],
 * //   isError: true
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleExportConfig} for exporting configuration
 * @see {@link handleSavePreferences} for individual preference updates
 */
export async function handleImportConfig(
  server: ALObjectIdServer,
  args: ImportConfigArgs
): Promise<ToolCallResponse> {
  const success = server.configPersistence.importConfig(args.config);

  if (success) {
    // Restore configuration
    // Call private method - this is a known pattern for this handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server as any).restoreConfiguration();

    return {
      content: [{
        type: "text",
        text: "✅ Configuration imported successfully"
      }]
    };
  }

  return {
    content: [{ type: "text", text: "Failed to import configuration" }],
    isError: true
  };
}