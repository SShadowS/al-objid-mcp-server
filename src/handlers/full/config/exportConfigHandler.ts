import { ALObjectIdServer } from '../../../server';
import { ExportConfigArgs } from '../../../lib/types/ToolHandlerArgs';

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Exports the complete configuration as JSON for backup or sharing
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for exporting config (currently unused)
 * @returns Promise resolving to complete configuration as JSON string
 *
 * @description
 * This handler exports the entire configuration state including
 * preferences, assignment history, and app settings for backup or migration.
 *
 * Exported configuration includes:
 * - User preferences
 * - Assignment history
 * - App authorizations
 * - Polling configuration
 * - Workspace settings
 * - Range configurations
 * - Statistics and metadata
 *
 * The export process:
 * 1. Gathers all configuration components
 * 2. Validates data integrity
 * 3. Formats as portable JSON
 * 4. Includes version metadata
 * 5. Returns complete export
 *
 * Use cases:
 * - Configuration backup
 * - Team settings sharing
 * - Environment migration
 * - Disaster recovery
 * - Configuration templating
 *
 * @example
 * ```typescript
 * // Export complete configuration
 * const result = await handleExportConfig(server, {});
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: JSON.stringify({
 * //       version: "1.0.0",
 * //       exportDate: "2024-01-15T10:30:00Z",
 * //       preferences: {
 * //         logLevel: "info",
 * //         autoSync: true
 * //       },
 * //       assignmentHistory: [...],
 * //       appAuthorizations: [...],
 * //       pollingConfig: {...},
 * //       statistics: {...}
 * //     })
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleImportConfig} for importing configuration
 * @see {@link handleGetPreferences} for preference-only export
 */
export async function handleExportConfig(
  server: ALObjectIdServer,
  _args: ExportConfigArgs
): Promise<ToolCallResponse> {
  const config = server.configPersistence.exportConfig();

  return {
    content: [{
      type: "text",
      text: config
    }]
  };
}