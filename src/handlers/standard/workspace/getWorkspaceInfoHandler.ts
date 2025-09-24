import { ALObjectIdServer } from '../../../server';

/**
 * Arguments for getting workspace info
 * Uses Record<string, never> to indicate no arguments
 */
export type GetWorkspaceInfoArgs = Record<string, never>;

/**
 * Response structure for tool calls
 * @interface
 */
interface ToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Gets information about the current workspace state
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments (currently unused)
 * @returns Promise resolving to workspace information
 * @throws {Error} When no workspace is currently active
 *
 * @description
 * This handler retrieves comprehensive information about the current workspace:
 * - Root path of the workspace
 * - Number of AL apps discovered
 * - Details for each app (name, version, authorization status, path)
 * - Currently active app
 *
 * The information is returned as formatted JSON for easy parsing and display.
 *
 * @example
 * ```typescript
 * const result = await handleGetWorkspaceInfo(server, {});
 * // Returns: {
 * //   content: [{
 * //     type: "text",
 * //     text: JSON.stringify({
 * //       rootPath: "/projects/bc-app",
 * //       appCount: 2,
 * //       apps: [
 * //         {
 * //           name: "MyApp",
 * //           version: "1.0.0",
 * //           authorized: true,
 * //           path: "/projects/bc-app/src"
 * //         },
 * //         {
 * //           name: "TestApp",
 * //           version: "1.0.0",
 * //           authorized: false,
 * //           path: "/projects/bc-app/test"
 * //         }
 * //       ],
 * //       activeApp: "MyApp"
 * //     }, null, 2)
 * //   }]
 * // }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleScanWorkspace} for scanning and discovering apps
 * @see {@link handleSetActiveApp} for changing the active app
 */
export async function handleGetWorkspaceInfo(
  server: ALObjectIdServer,
  _args: GetWorkspaceInfoArgs
): Promise<ToolCallResponse> {
  const workspace = server.workspaceManager.getCurrentWorkspace();

  if (!workspace) {
    return {
      content: [{ type: "text", text: "No workspace is currently active" }],
      isError: true
    };
  }

  const info = {
    rootPath: workspace.rootPath,
    appCount: workspace.apps.length,
    apps: workspace.apps.map((app: { name: string; version: string; isAuthorized: boolean; path: string }) => ({
      name: app.name,
      version: app.version,
      authorized: app.isAuthorized,
      path: app.path
    })),
    activeApp: workspace.activeApp?.name || 'None'
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify(info, null, 2)
    }]
  };
}