import { ALObjectIdServer } from '../../../server';

/**
 * Arguments for checking app authorization
 * @interface
 */
export interface CheckAuthorizationArgs {
  /**
   * Path to the AL app directory
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
 * Checks if an AL app is authorized with the backend service
 *
 * @param server - The ALObjectIdServer instance providing context and services
 * @param args - The arguments for checking authorization
 * @param args.appPath - Path to the AL app to check authorization for
 * @returns Promise resolving to the authorization status response
 * @throws {Error} When the app path is invalid or app cannot be found
 *
 * @example
 * ```typescript
 * const result = await handleCheckAuthorization(server, {
 *   appPath: '/workspace/src/app'
 * });
 * // Returns: { content: [{ type: "text", text: "✅ App is authorized" }] }
 * ```
 *
 * @since 1.0.0
 * @see {@link handleAuthorizeApp} for authorizing an app
 */
export async function handleCheckAuthorization(
  server: ALObjectIdServer,
  args: CheckAuthorizationArgs
): Promise<ToolCallResponse> {
  const app = await server.getAppFromPath(args.appPath);

  if (!app) {
    return {
      content: [{ type: "text", text: "No AL app found at the specified path" }],
      isError: true
    };
  }

  if (app.isAuthorized) {
    return {
      content: [{
        type: "text",
        text: `✅ App "${app.name}" is authorized`
      }]
    };
  }

  return {
    content: [{
      type: "text",
      text: `❌ App "${app.name}" is not authorized`
    }]
  };
}