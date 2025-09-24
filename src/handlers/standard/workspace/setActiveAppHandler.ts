import { ALObjectIdServer } from '../../../server';

/**
 * Arguments for setting the active app
 * @interface
 */
export interface SetActiveAppArgs {
  /**
   * Path to the AL app to set as active
   * Can be absolute or relative to the workspace
   * If empty, clears the active app
   * @default ""
   */
  appPath?: string;
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
 * Sets the active AL app in a multi-app workspace
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for setting the active app
 * @param args.appPath - Path to the app to activate, or empty to clear
 * @returns Promise resolving to the operation result
 * @throws {Error} When the specified app is not found in the workspace
 *
 * @description
 * This handler manages which app is currently active in a multi-app workspace.
 * The active app is used as the default for operations that don't specify
 * an explicit app path.
 *
 * The process:
 * 1. Validates the specified app exists in the workspace
 * 2. Sets it as the active app
 * 3. Persists the workspace state
 * 4. Returns confirmation with the app name
 *
 * @example
 * ```typescript
 * // Set an app as active
 * const result = await handleSetActiveApp(server, {
 *   appPath: '/workspace/src/app'
 * });
 * // Returns: { content: [{ type: "text", text: "✅ Active app set to: MyApp" }] }
 *
 * // Clear the active app
 * const result = await handleSetActiveApp(server, {
 *   appPath: ''
 * });
 * ```
 *
 * @since 1.0.0
 * @see {@link handleScanWorkspace} for discovering apps
 * @see {@link handleGetWorkspaceInfo} for checking current active app
 */
export async function handleSetActiveApp(
  server: ALObjectIdServer,
  args: SetActiveAppArgs
): Promise<ToolCallResponse> {
  const workspaceManager = server.workspaceManager;
  const success = workspaceManager.setActiveApp(args.appPath || '');

  if (success) {
    const workspace = workspaceManager.getCurrentWorkspace();
    if (workspace) {
      // Save to persistence
      const persistence = server.configPersistence;
      persistence.saveWorkspace(
        workspace.rootPath,
        workspace.apps,
        workspace.activeApp?.appId
      );

      return {
        content: [{
          type: "text",
          text: `✅ Active app set to: ${workspace.activeApp?.name}`
        }]
      };
    }
  }

  return {
    content: [{ type: "text", text: "Failed to set active app" }],
    isError: true
  };
}