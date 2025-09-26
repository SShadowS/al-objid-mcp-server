/**
 * Authorization Tool for LITE mode
 */

import { BaseTool } from '../base/BaseTool';
import { authorizationSchema } from '../../lib/validation/schemas';
import { AuthorizationParams } from '../../lib/types/tools/lite';
import { AuthorizationResult } from '../../lib/types/tools/lite';
import { BackendService } from '../../lib/backend/BackendService';
import { ConfigManager } from '../../lib/config/ConfigManager';
import { WorkspaceUtils } from '../../lib/utils/workspace';
import { Logger } from '../../lib/utils/logger';
import { ErrorCode } from '../../lib/types/common/errors';

/**
 * Authorization tool for managing app authorization
 */
export class AuthorizationTool extends BaseTool<AuthorizationParams, AuthorizationResult> {
  private backend: BackendService;
  private config: ConfigManager;
  private logger: Logger;

  constructor() {
    super(
      'authorization',
      'Manage app authorization for Object ID synchronization. REQUIRES action ("status"|"start"|"deauthorize"), appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/app.json". Optional: interactive (boolean, default: true).',
      authorizationSchema
    );

    this.config = ConfigManager.getInstance();
    const serverConfig = this.config.getServerConfig();
    this.backend = new BackendService(serverConfig.backendUrl, serverConfig.backendApiKey);
    this.logger = Logger.getInstance();
  }

  protected async executeInternal(params: AuthorizationParams): Promise<AuthorizationResult> {
    this.logger.info(`Authorization action: ${params.action}`, { appPath: params.appPath });

    // Validate app path
    const validation = await WorkspaceUtils.validateAppPath(params.appPath);
    if (!validation.valid) {
      throw this.createError(
        ErrorCode.APP_NOT_FOUND,
        validation.reason || 'Invalid app path'
      );
    }

    try {
      // Execute authorization action
      const result = await this.backend.authorization(params);

      // Add app info if status check
      if (params.action === 'status' && result.authorized) {
        const appJson = await this.config.readAppJson(params.appPath);
        result.app_info = {
          id: appJson.id as string,
          name: appJson.name as string,
          version: appJson.version as string,
          publisher: appJson.publisher as string
        };
      }

      // Log result
      this.logger.info(`Authorization ${params.action} completed`, {
        authorized: result.authorized,
        appPath: params.appPath
      });

      return result;
    } catch (error) {
      this.logger.error(`Authorization failed for ${params.action}`, error);
      throw error;
    }
  }
}