import { ALObjectIdServer } from '../../../server';

/**
 * Arguments for authorizing an AL app
 * @interface
 */
export interface AuthorizeAppArgs {
  /**
   * Path to the AL app directory to authorize
   * Can be absolute or relative to the workspace
   */
  appPath: string;
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
 * Authorizes an AL app with the backend service
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for authorizing the app
 * @param args.appPath - Path to the AL app to authorize
 * @returns Promise resolving to the authorization result
 * @throws {Error} When the app path is invalid or authorization fails
 *
 * @description
 * This handler performs app authorization with the backend service.
 * The authorization process:
 * 1. Validates the app exists at the specified path
 * 2. Uses pool ID if the app is part of a pool
 * 3. Sends authorization request to backend
 * 4. Updates workspace with auth key on success
 * 5. Persists the authorization state
 *
 * Note: Git integration is simplified in this version.
 * Full git user/email/repo detection will be added in future phases.
 *
 * @example
 * ```typescript
 * const result = await handleAuthorizeApp(server, {
 *   appPath: '/workspace/src/app'
 * });
 * // Returns: { content: [{ type: "text", text: "✅ App \"MyApp\" has been authorized successfully" }] }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleCheckAuthorization} for checking authorization status
 */
export async function handleAuthorizeApp(
  server: ALObjectIdServer,
  args: AuthorizeAppArgs
): Promise<ToolCallResponse> {
  const app = await server.getAppFromPath(args.appPath);

  if (!app) {
    return {
      content: [{ type: "text", text: "No AL app found at the specified path" }],
      isError: true
    };
  }

  // Use pool ID if available (matches VSCode extension behavior)
  const workspace = server.workspaceManager;
  const appId = workspace.getPoolIdFromAppIdIfAvailable(app.appId);

  // For now, use simplified authorization (Phase 4 will add full git integration)
  const request = {
    appId,
    appName: app.name,
    gitUser: 'user',
    gitEmail: 'user@example.com',
    gitRepo: 'repo',
    gitBranch: 'main'
  };

  const backend = server.backendService;
  const result = await backend.authorizeApp(request);

  if (result) {
    // Update workspace manager with the result auth key
    workspace.updateAppAuthorization(app.path, result.authKey);

    // Save to persistence
    const currentWorkspace = workspace.getCurrentWorkspace();
    const persistence = server.configPersistence;

    if (currentWorkspace) {
      persistence.saveWorkspace(
        currentWorkspace.rootPath,
        currentWorkspace.apps,
        currentWorkspace.activeApp?.appId
      );
    }

    return {
      content: [{
        type: "text",
        text: `✅ App "${app.name}" has been authorized successfully`
      }]
    };
  }

  return {
    content: [{ type: "text", text: "Authorization failed. Please check the auth key." }],
    isError: true
  };
}