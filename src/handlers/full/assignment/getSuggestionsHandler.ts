import { ALObjectIdServer } from '../../../server';
import { GetSuggestionsArgs } from '../../../lib/types/ToolHandlerArgs';
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
 * Gets intelligent ID assignment suggestions based on patterns and usage
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for getting suggestions
 * @param args.appPath - Optional path to the AL app
 * @param args.objectType - Type of AL object to get suggestions for
 * @param args.pattern - Optional pattern or naming convention to match
 * @returns Promise resolving to ID suggestions
 * @throws {Error} When app is not found
 *
 * @description
 * This handler provides intelligent ID suggestions based on multiple factors:
 * - Current ID usage patterns in the app
 * - Available ranges in configuration
 * - Naming conventions and patterns
 * - Recently assigned IDs
 * - Collision-free recommendations
 *
 * The suggestion algorithm considers:
 * 1. Historical assignment patterns
 * 2. Configured ID ranges
 * 3. Existing ID gaps that could be filled
 * 4. Pattern-based recommendations (e.g., tables in 100s, pages in 200s)
 * 5. Collision avoidance with other apps
 *
 * Use cases:
 * - Guide developers to consistent ID patterns
 * - Find optimal IDs for new objects
 * - Identify available ID ranges
 * - Maintain naming/numbering conventions
 *
 * @example
 * ```typescript
 * // Get suggestions for a new table
 * const result = await handleGetSuggestions(server, {
 *   objectType: 'table',
 *   pattern: 'Customer'
 * });
 * // Returns:
 * // {
 * //   content: [{
 * //     type: "text",
 * //     text: "📊 ID Assignment Suggestions for table:\n\n" +
 * //           "Next available: 50105\n\n" +
 * //           "Suggested ranges:\n" +
 * //           "- 50100-50199 (95 available)\n" +
 * //           "- 50300-50399 (100 available)\n\n" +
 * //           "Patterns:\n" +
 * //           "- Customer tables: 50100-50109\n" +
 * //           "- Vendor tables: 50110-50119\n\n" +
 * //           "Recently used: 50100, 50101, 50102, 50103, 50104"
 * //   }]
 * // }
 *
 * // Get suggestions for pages without pattern
 * const result = await handleGetSuggestions(server, {
 *   appPath: '/workspace/app',
 *   objectType: 'page'
 * });
 * // Returns suggestions based on available ranges and usage
 * ```
 *
 * @since 1.0.0
 * @see {@link handleAssignIds} for actual ID assignment
 * @see {@link handleGetAssignmentHistory} for viewing past assignments
 */
export async function handleGetSuggestions(
  server: ALObjectIdServer,
  args: GetSuggestionsArgs
): Promise<ToolCallResponse> {
  const app = await server.getAppFromPath(args.appPath);
  if (!app) {
    return {
      content: [{ type: "text", text: "No AL app found" }],
      isError: true
    };
  }

  const suggestions = await server.assignmentManager.getSuggestions(
    app,
    args.objectType as ALObjectType,
    args.pattern
  );

  let response = `📊 ID Assignment Suggestions for ${args.objectType}:\n\n`;
  response += `Next available: ${suggestions.nextAvailable || 'None'}\n\n`;

  if (suggestions.suggestedRanges.length > 0) {
    response += `Suggested ranges:\n`;
    suggestions.suggestedRanges.forEach((r: { from: number; to: number; available: number }) => {
      response += `- ${r.from}-${r.to} (${r.available} available)\n`;
    });
    response += '\n';
  }

  if (suggestions.patterns.length > 0) {
    response += `Patterns:\n`;
    suggestions.patterns.forEach((p: { pattern: string; example: number }) => {
      response += `- ${p.pattern}: ${p.example}\n`;
    });
    response += '\n';
  }

  if (suggestions.recentlyUsed.length > 0) {
    response += `Recently used: ${suggestions.recentlyUsed.join(', ')}`;
  }

  return {
    content: [{ type: "text", text: response }]
  };
}