/**
 * Allocate ID Tool for LITE mode
 */

import { BaseTool } from '../base/BaseTool';
import { allocateIdSchema } from '../../lib/validation/schemas';
import { AllocateIdParams, AllocateIdResult } from '../../lib/types/tools/lite';
import { BackendService } from '../../lib/backend/BackendService';
import { ConfigManager } from '../../lib/config/ConfigManager';
import { WorkspaceUtils } from '../../lib/utils/workspace';
import { Logger } from '../../lib/utils/logger';
import { ErrorCode } from '../../lib/types/common/errors';
import { Range } from '../../lib/types/common/base';

/**
 * ID allocation tool for managing object IDs
 */
export class AllocateIdTool extends BaseTool<AllocateIdParams, AllocateIdResult> {
  private backend: BackendService;
  private config: ConfigManager;
  private logger: Logger;

  constructor() {
    super(
      'allocate_id',
      'Preview, reserve, or reclaim object IDs for AL development. REQUIRES mode ("preview"|"reserve"|"reclaim"), appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/app.json". REQUIRES object_type (AL object type string). Optional: count (number, default: 1), pool_id (string), preferred_range ({from:number, to:number}), object_metadata ({name?:string, file?:string, tag?:string}), ids (number[], reclaim mode only), dry_run (boolean, default: false).',
      allocateIdSchema
    );

    this.config = ConfigManager.getInstance();
    const serverConfig = this.config.getServerConfig();
    this.backend = new BackendService(serverConfig.backendUrl, serverConfig.backendApiKey);
    this.logger = Logger.getInstance();
  }

  protected async executeInternal(params: AllocateIdParams): Promise<AllocateIdResult> {
    this.logger.info(`Allocate ID mode: ${params.mode}`, {
      appPath: params.appPath,
      objectType: params.object_type,
      count: params.count
    });

    // Validate app path
    const validation = await WorkspaceUtils.validateAppPath(params.appPath);
    if (!validation.valid) {
      throw this.createError(
        ErrorCode.APP_NOT_FOUND,
        validation.reason || 'Invalid app path'
      );
    }

    // Load configuration
    const config = await this.config.readObjIdConfig(params.appPath);
    if (!config) {
      throw this.createError(
        ErrorCode.CONFIG_NOT_FOUND,
        'No .objidconfig file found. Please configure ID ranges first.'
      );
    }

    // Validate object type has ranges
    const objectType = params.object_type.toLowerCase();
    const ranges = config.idRanges ? config.idRanges[objectType] : undefined;
    if (!ranges || ranges.length === 0) {
      throw this.createError(
        ErrorCode.NO_RANGES_DEFINED,
        `No ID ranges defined for object type: ${objectType}`
      );
    }

    switch (params.mode) {
      case 'preview':
        return this.handlePreview(params, ranges);
      case 'reserve':
        return this.handleReserve(params, ranges);
      case 'reclaim':
        return this.handleReclaim(params);
      default:
        throw this.createError(
          ErrorCode.INVALID_ACTION,
          `Unknown allocation mode: ${params.mode}`
        );
    }
  }

  /**
   * Handle preview mode - show available IDs without reserving
   */
  private async handlePreview(
    params: AllocateIdParams,
    ranges: Range[]
  ): Promise<AllocateIdResult> {
    try {
      // Get consumed IDs from workspace
      const objects = await WorkspaceUtils.scanWorkspace(params.appPath, {
        objectTypes: [params.object_type as any]
      });

      const consumedIds = new Set(objects.map(obj => obj.id));
      const availableIds: number[] = [];
      const count = params.count || 1;

      // Find available IDs in ranges
      for (const range of ranges) {
        // Prefer the specified range if provided
        if (params.preferred_range) {
          if (range.from !== params.preferred_range.from || range.to !== params.preferred_range.to) {
            continue;
          }
        }

        for (let id = range.from; id <= range.to && availableIds.length < count; id++) {
          if (!consumedIds.has(id)) {
            availableIds.push(id);
          }
        }

        if (availableIds.length >= count) {
          break;
        }
      }

      if (availableIds.length === 0) {
        throw this.createError(
          ErrorCode.NO_IDS_AVAILABLE,
          `No available IDs found for ${params.object_type}`
        );
      }

      return {
        mode: 'preview',
        ids: availableIds.slice(0, count),
        object_type: params.object_type,
        available_count: availableIds.length,
        pool_info: params.pool_id ? {
          pool_id: params.pool_id,
          name: `Pool ${params.pool_id}`,
          size: ranges.reduce((sum, r) => sum + (r.to - r.from + 1), 0)
        } : undefined
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      this.logger.error('Preview failed', error);
      throw this.createError(
        ErrorCode.BACKEND_ERROR,
        error instanceof Error ? error.message : 'Preview failed'
      );
    }
  }

  /**
   * Handle reserve mode - actually allocate IDs
   */
  private async handleReserve(
    params: AllocateIdParams,
    ranges: Range[]
  ): Promise<AllocateIdResult> {
    try {
      // If dry_run, just do a preview
      if (params.dry_run) {
        const preview = await this.handlePreview(params, ranges);
        return {
          ...preview,
          mode: 'reserve',
          reserved: false,
          dry_run: true
        };
      }

      // Get next available IDs from backend
      const result = await this.backend.allocateId({
        ...params,
        mode: 'reserve'
      });

      // Validate returned IDs are within ranges
      const invalidIds = result.ids.filter(id => {
        return !ranges.some(range => id >= range.from && id <= range.to);
      });

      if (invalidIds.length > 0) {
        this.logger.warn('Backend returned IDs outside configured ranges', {
          invalidIds,
          ranges
        });
      }

      return {
        ...result,
        mode: 'reserve',
        reserved: true,
        metadata: params.object_metadata
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      this.logger.error('Reserve failed', error);
      throw this.createError(
        ErrorCode.BACKEND_ERROR,
        error instanceof Error ? error.message : 'Reserve failed'
      );
    }
  }

  /**
   * Handle reclaim mode - return IDs to the pool
   */
  private async handleReclaim(params: AllocateIdParams): Promise<AllocateIdResult> {
    if (!params.ids || params.ids.length === 0) {
      throw this.createError(
        ErrorCode.INVALID_PARAMETER,
        'ids parameter is required for reclaim mode'
      );
    }

    try {
      if (params.dry_run) {
        return {
          mode: 'reclaim',
          ids: params.ids,
          object_type: params.object_type,
          reclaimed_count: params.ids.length,
          dry_run: true
        };
      }

      const result = await this.backend.allocateId({
        ...params,
        mode: 'reclaim'
      });

      return {
        ...result,
        mode: 'reclaim',
        reclaimed_count: params.ids.length - (result.failed_ids?.length || 0)
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      this.logger.error('Reclaim failed', error);
      throw this.createError(
        ErrorCode.BACKEND_ERROR,
        error instanceof Error ? error.message : 'Reclaim failed'
      );
    }
  }
}