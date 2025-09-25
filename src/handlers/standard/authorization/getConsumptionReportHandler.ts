import { ALObjectIdServer } from '../../../server';
import { ALObjectType } from '../../../lib/types/ALObjectType';

/**
 * Arguments for getting a consumption report
 * @interface
 */
export interface GetConsumptionReportArgs {
  /**
   * Path to the AL app directory
   * Can be absolute or relative to the workspace
   */
  appPath: string;

  /**
   * Optional array of object types to include in the report
   * If not specified, includes all main object types
   * @default ["table", "page", "report", "codeunit", "query", "xmlport", "enum"]
   */
  objectTypes?: string[];
}

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Gets a consumption report showing which object IDs are in use for an app
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for generating the consumption report
 * @param args.appPath - Path to the AL app to report on
 * @param args.objectTypes - Optional array of object types to include
 * @returns Promise resolving to the consumption report
 * @throws {Error} When the app is not found or not authorized
 *
 * @description
 * This handler retrieves ID consumption data from the backend and formats it
 * into a readable report. The process:
 * 1. Validates the app exists and is authorized
 * 2. Determines which object types to include
 * 3. Fetches consumption data from backend (using pool ID if available)
 * 4. Formats the data into a summary report
 *
 * The report shows:
 * - Object type and count of consumed IDs
 * - First 5 IDs for each type (with ellipsis if more)
 *
 * @example
 * ```typescript
 * const result = await handleGetConsumptionReport(server, {
 *   appPath: '/workspace/src/app',
 *   objectTypes: ['table', 'page']
 * });
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: "📊 Consumption Report for \"MyApp\":\n\ntable: 5 IDs (50100, 50101, 50102, 50103, 50104)\npage: 3 IDs (50100, 50101, 50102)"
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleCheckAuthorization} for checking authorization status
 * @see {@link ALObjectType} for available object types
 */
export async function handleGetConsumptionReport(
  server: ALObjectIdServer,
  args: GetConsumptionReportArgs
): Promise<ToolCallResponse> {
  const app = await server.getAppFromPath(args.appPath);

  if (!app) {
    return {
      content: [{ type: "text", text: "No AL app found at the specified path" }],
      isError: true
    };
  }

  if (!app.isAuthorized || !app.authKey) {
    return {
      content: [{ type: "text", text: "App is not authorized. Please authorize first." }],
      isError: true
    };
  }

  const objectTypes = args.objectTypes || [
    ALObjectType.Table,
    ALObjectType.Page,
    ALObjectType.Report,
    ALObjectType.Codeunit,
    ALObjectType.Query,
    ALObjectType.XmlPort,
    ALObjectType.Enum
  ];

  const report: Record<string, number[]> = {};

  // Get all consumption at once using pool ID if available (matches VSCode extension behavior)
  const workspace = server.workspaceManager;
  const appId = workspace.getPoolIdFromAppIdIfAvailable(app.appId);

  const request = {
    appId,
    authKey: app.authKey
  };

  const backend = server.backendService;
  const consumptionInfo = await backend.getConsumption(request);

  if (consumptionInfo) {
    for (const objectType of objectTypes) {
      const consumption = consumptionInfo[objectType as ALObjectType] || [];
      if (consumption.length > 0) {
        report[objectType] = consumption;
      }
    }
  }

  const summary = Object.entries(report)
    .map(([type, ids]) => `${type}: ${ids.length} IDs (${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''})`)
    .join('\n');

  return {
    content: [{
      type: "text",
      text: `📊 Consumption Report for "${app.name}":\n\n${summary || 'No consumed IDs found'}`
    }]
  };
}