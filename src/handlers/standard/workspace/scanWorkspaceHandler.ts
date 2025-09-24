import { ALObjectIdServer } from '../../../server';

/**
 * Arguments for scanning a workspace
 * @interface
 */
export interface ScanWorkspaceArgs {
  /**
   * Path to the workspace root directory to scan
   * Can be absolute or relative path
   */
  workspacePath: string;
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
 * Scans a workspace directory for AL apps and their configurations
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for scanning the workspace
 * @param args.workspacePath - Path to the workspace to scan
 * @returns Promise resolving to the scan results
 * @throws {Error} When workspace path is invalid or inaccessible
 *
 * @description
 * This handler performs a comprehensive scan of the workspace to discover:
 * - AL apps (via app.json files)
 * - Configuration files (.objidconfig)
 * - Authorization status for each app
 * - App versions and metadata
 *
 * The scan process:
 * 1. Recursively searches for app.json files
 * 2. Loads configuration for each discovered app
 * 3. Checks authorization status
 * 4. Persists workspace state for future use
 * 5. Returns formatted list of discovered apps
 *
 * @example
 * ```typescript
 * const result = await handleScanWorkspace(server, {
 *   workspacePath: '/projects/bc-app'
 * });
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: "Found 2 AL app(s):\n- MyApp v1.0.0 ✅\n- TestApp v1.0.0 ❌"
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleGetWorkspaceInfo} for retrieving workspace state
 * @see {@link handleSetActiveApp} for setting the active app
 */
export async function handleScanWorkspace(
  server: ALObjectIdServer,
  args: ScanWorkspaceArgs
): Promise<ToolCallResponse> {
  const workspaceManager = server.workspaceManager;
  const workspace = await workspaceManager.scanWorkspace(args.workspacePath);

  // Save to persistence
  const persistence = server.configPersistence;
  persistence.saveWorkspace(
    workspace.rootPath,
    workspace.apps,
    workspace.activeApp?.appId
  );

  const appList = workspace.apps
    .map((app: { name: string; version: string; isAuthorized: boolean }) => `- ${app.name} v${app.version} ${app.isAuthorized ? '✅' : '❌'}`)
    .join('\n');

  return {
    content: [{
      type: "text",
      text: `Found ${workspace.apps.length} AL app(s):\n${appList}`
    }]
  };
}