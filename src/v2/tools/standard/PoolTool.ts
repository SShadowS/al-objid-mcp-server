/**
 * Pool Tool - Manages app pools for shared ID management
 */

import { BaseTool } from '../base/BaseTool';
import { poolSchema, PoolInput } from '../../lib/validation/standardSchemas';
import { PoolParams, PoolResult } from '../../lib/types/tools/standard';
import { BackendService } from '../../lib/backend/BackendService';
import { ConfigManager } from '../../lib/config/ConfigManager';
import { ErrorCode } from '../../lib/errors/codes';
import { Logger } from '../../lib/utils/logger';

export class PoolTool extends BaseTool<PoolParams, PoolResult> {
  private backend: BackendService;
  private config: ConfigManager;
  private logger: Logger;

  constructor() {
    super(
      'pool',
      'Manage app pools for shared object ID management. REQUIRES action ("create"|"join"|"leave"|"info"|"remove"|"rename"), appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/app.json". Optional: poolId (string, required for join/leave/info/remove/rename), poolName (string, required for create/rename), description (string, create only), force (boolean, applies to leave/remove).',
      poolSchema
    );
    this.config = ConfigManager.getInstance();
    const serverConfig = this.config.getServerConfig();
    this.backend = new BackendService(serverConfig.backendUrl, serverConfig.backendApiKey);
    this.logger = Logger.getInstance();
  }

  protected async executeInternal(params: PoolInput): Promise<PoolResult> {
    this.logger.info(`Pool action: ${params.action}`, { appPath: params.appPath });

    // Validate app path
    const appInfo = await this.config.readAppJson(params.appPath);
    const appId = appInfo.id as string;
    if (!appId) {
      throw this.createError(
        ErrorCode.APP_NOT_FOUND,
        'Invalid app.json file'
      );
    }

    try {
      switch (params.action) {
        case 'create':
          return await this.createPool(params, appId);

        case 'join':
          return await this.joinPool(params, appId);

        case 'leave':
          return await this.leavePool(params, appId);

        case 'info':
          return await this.getPoolInfo(params, appId);

        case 'remove':
          return await this.removePool(params, appId);

        case 'rename':
          return await this.renamePool(params, appId);

        default:
          throw this.createError(
            ErrorCode.INVALID_PARAMETER,
            `Unknown pool action: ${params.action}`
          );
      }
    } catch (error) {
      this.logger.error(`Pool operation failed: ${params.action}`, error);
      throw error;
    }
  }

  private async createPool(params: PoolInput, appId: string): Promise<PoolResult> {
    if (!params.poolName) {
      throw this.createError(
        ErrorCode.INVALID_PARAMETER,
        'Pool name is required for create action'
      );
    }

    const result = await this.backend.pool({
      action: 'create',
      appId,
      poolName: params.poolName,
      description: params.description
    });

    return {
      action: 'create',
      success: true,
      poolId: result.poolId,
      poolName: params.poolName,
      message: `Pool "${params.poolName}" created successfully`
    };
  }

  private async joinPool(params: PoolInput, appId: string): Promise<PoolResult> {
    if (!params.poolId && !params.poolName) {
      throw this.createError(
        ErrorCode.INVALID_PARAMETER,
        'Pool ID or name is required for join action'
      );
    }

    const result = await this.backend.pool({
      action: 'join',
      appId,
      poolId: params.poolId,
      poolName: params.poolName
    });

    return {
      action: 'join',
      success: true,
      poolId: result.poolId,
      message: `Successfully joined pool`
    };
  }

  private async leavePool(params: PoolInput, appId: string): Promise<PoolResult> {
    await this.backend.pool({
      action: 'leave',
      appId,
      force: params.force
    });

    return {
      action: 'leave',
      success: true,
      message: 'Successfully left the pool'
    };
  }

  private async getPoolInfo(_params: PoolInput, appId: string): Promise<PoolResult> {
    const result = await this.backend.pool({
      action: 'info',
      appId
    });

    // Transform backend response to match PoolResult structure
    let poolInfo = undefined;
    // Backend returns the pool info directly, not wrapped in a poolInfo property
    if (result) {
      const backendInfo = result as any; // Backend returns different structure
      poolInfo = {
        id: backendInfo.poolId || '',
        name: backendInfo.name || '',
        description: backendInfo.description,
        apps: Array.isArray(backendInfo.apps)
          ? backendInfo.apps.map((app: any) => typeof app === 'string' ? app : app.name || app.appId || '')
          : [],
        created: backendInfo.created || new Date().toISOString(),
        updated: backendInfo.updated || new Date().toISOString()
      };
    }

    return {
      action: 'info',
      success: true,
      poolInfo
    };
  }

  private async removePool(params: PoolInput, appId: string): Promise<PoolResult> {
    if (!params.force) {
      throw this.createError(
        ErrorCode.INVALID_PARAMETER,
        'Force flag is required for pool removal'
      );
    }

    await this.backend.pool({
      action: 'remove',
      appId,
      poolId: params.poolId
    });

    return {
      action: 'remove',
      success: true,
      message: 'Pool removed successfully'
    };
  }

  private async renamePool(params: PoolInput, appId: string): Promise<PoolResult> {
    if (!params.poolName) {
      throw this.createError(
        ErrorCode.INVALID_PARAMETER,
        'New pool name is required for rename action'
      );
    }

    await this.backend.pool({
      action: 'rename',
      appId,
      poolId: params.poolId,
      newName: params.poolName
    });

    return {
      action: 'rename',
      success: true,
      poolName: params.poolName,
      message: `Pool renamed to "${params.poolName}"`
    };
  }
}