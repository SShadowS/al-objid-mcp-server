/**
 * Assignment Tool - Manual ID assignment tracking
 */

import { BaseTool } from '../base/BaseTool';
import { assignmentSchema, AssignmentInput } from '../../lib/validation/standardSchemas';
import { AssignmentParams, AssignmentResult } from '../../lib/types/tools/standard';
import { BackendService } from '../../lib/backend/BackendService';
import { ConfigManager } from '../../lib/config/ConfigManager';
import { WorkspaceUtils } from '../../lib/utils/workspace';
import { ErrorCode } from '../../lib/errors/codes';
import { Logger } from '../../lib/utils/logger';

export class AssignmentTool extends BaseTool<AssignmentParams, AssignmentResult> {
  private backend: BackendService;
  private config: ConfigManager;
  private logger: Logger;

  constructor() {
    super(
      'assignment',
      'Manually track or untrack object ID assignments. REQUIRES action ("store"|"remove"|"check"), appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/app.json". REQUIRES object_type (AL object type string), id (number). Optional: authKey (string, authorization key for backend).',
      assignmentSchema
    );
    this.config = ConfigManager.getInstance();
    const serverConfig = this.config.getServerConfig();
    this.backend = new BackendService(serverConfig.backendUrl, serverConfig.backendApiKey);
    this.logger = Logger.getInstance();
  }

  protected async executeInternal(params: AssignmentInput): Promise<AssignmentResult> {
    this.logger.info(`Assignment ${params.action}`, {
      appPath: params.appPath,
      objectType: params.object_type,
      id: params.id
    });

    // Validate app path
    const validation = await WorkspaceUtils.validateAppPath(params.appPath);
    if (!validation.valid) {
      throw this.createError(
        ErrorCode.APP_NOT_FOUND,
        validation.reason || 'Invalid app path'
      );
    }

    switch (params.action) {
      case 'store':
        return this.handleStore(params);
      case 'remove':
        return this.handleRemove(params);
      case 'check':
        return this.handleCheck(params);
      default:
        throw this.createError(
          ErrorCode.INVALID_ACTION,
          `Unknown assignment action: ${params.action}`
        );
    }
  }

  /**
   * Store an ID assignment
   */
  private async handleStore(params: AssignmentInput): Promise<AssignmentResult> {
    try {
      const result = await this.backend.storeAssignment({
        appPath: params.appPath,
        authKey: params.authKey,
        type: params.object_type,
        id: params.id
      });

      const success = result.updated === true;

      this.logger.info(`Assignment stored: ${params.object_type} ${params.id}`, { success });

      return {
        action: 'store',
        success,
        object_type: params.object_type,
        id: params.id,
        message: success
          ? `Successfully stored assignment for ${params.object_type} ${params.id}`
          : `Failed to store assignment for ${params.object_type} ${params.id}`
      };
    } catch (error) {
      this.logger.error('Store assignment failed', error);
      throw this.createError(
        ErrorCode.BACKEND_ERROR,
        error instanceof Error ? error.message : 'Failed to store assignment'
      );
    }
  }

  /**
   * Remove an ID assignment
   */
  private async handleRemove(params: AssignmentInput): Promise<AssignmentResult> {
    try {
      const result = await this.backend.removeAssignment({
        appPath: params.appPath,
        authKey: params.authKey,
        type: params.object_type,
        id: params.id
      });

      const success = result.updated === true;

      this.logger.info(`Assignment removed: ${params.object_type} ${params.id}`, { success });

      return {
        action: 'remove',
        success,
        object_type: params.object_type,
        id: params.id,
        message: success
          ? `Successfully removed assignment for ${params.object_type} ${params.id}`
          : `Failed to remove assignment for ${params.object_type} ${params.id}`
      };
    } catch (error) {
      this.logger.error('Remove assignment failed', error);
      throw this.createError(
        ErrorCode.BACKEND_ERROR,
        error instanceof Error ? error.message : 'Failed to remove assignment'
      );
    }
  }

  /**
   * Check if an ID is assigned
   */
  private async handleCheck(params: AssignmentInput): Promise<AssignmentResult> {
    try {
      // Get consumption data and check if this ID is tracked
      const consumption = await this.backend.getConsumption({
        appPath: params.appPath,
        authKey: params.authKey
      });

      const typeConsumption = (consumption as any)[params.object_type];
      const tracked = Array.isArray(typeConsumption) &&
                     typeConsumption.some((id: any) => {
                       const numId = typeof id === 'number' ? id : id.id;
                       return numId === params.id;
                     });

      this.logger.info(`Assignment check: ${params.object_type} ${params.id}`, { tracked });

      return {
        action: 'check',
        success: true,
        object_type: params.object_type,
        id: params.id,
        tracked,
        message: tracked
          ? `${params.object_type} ${params.id} is tracked`
          : `${params.object_type} ${params.id} is not tracked`
      };
    } catch (error) {
      this.logger.error('Check assignment failed', error);
      throw this.createError(
        ErrorCode.BACKEND_ERROR,
        error instanceof Error ? error.message : 'Failed to check assignment'
      );
    }
  }
}
