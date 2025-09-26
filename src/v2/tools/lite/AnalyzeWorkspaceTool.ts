/**
 * Analyze Workspace Tool for LITE mode
 */

import { BaseTool } from '../base/BaseTool';
import { analyzeWorkspaceSchema } from '../../lib/validation/schemas';
import { AnalyzeWorkspaceParams, AnalyzeWorkspaceResult, ConsumptionInfo, Collision } from '../../lib/types/tools/lite';
import { BackendService } from '../../lib/backend/BackendService';
import { ConfigManager } from '../../lib/config/ConfigManager';
import { WorkspaceUtils, ALObject } from '../../lib/utils/workspace';
import { Logger } from '../../lib/utils/logger';
import { ErrorCode } from '../../lib/types/common/errors';

/**
 * Workspace analysis tool for ID consumption and collisions
 */
export class AnalyzeWorkspaceTool extends BaseTool<AnalyzeWorkspaceParams, AnalyzeWorkspaceResult> {
  private backend: BackendService;
  private config: ConfigManager;
  private logger: Logger;

  constructor() {
    super(
      'analyze_workspace',
      'Analyze AL workspace for object ID consumption, collisions, and pool mapping. REQUIRES appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/app.json" or "path/to/file.app". Optional: include (string[], default: ["**/*.al"]), exclude (string[], default: ["**/.alpackages/**", "**/.snapshots/**"]), object_types (string[]), return_level ("summary"|"detailed", default: "summary"), detect_collisions (boolean, default: true), map_to_pools (boolean, default: false).',
      analyzeWorkspaceSchema
    );

    this.config = ConfigManager.getInstance();
    const serverConfig = this.config.getServerConfig();
    this.backend = new BackendService(serverConfig.backendUrl, serverConfig.backendApiKey);
    this.logger = Logger.getInstance();
  }

  protected async executeInternal(params: AnalyzeWorkspaceParams): Promise<AnalyzeWorkspaceResult> {
    this.logger.info('Analyzing workspace', {
      appPath: params.appPath,
      returnLevel: params.return_level
    });

    // Validate app path
    const validation = await WorkspaceUtils.validateAppPath(params.appPath);
    if (!validation.valid) {
      throw this.createError(
        ErrorCode.APP_NOT_FOUND,
        validation.reason || 'Invalid app path'
      );
    }

    // Normalize to workspace directory
    const workspacePath = WorkspaceUtils.normalizeAppPath(params.appPath);

    try {
      // Scan workspace for AL objects
      const objects = await WorkspaceUtils.scanWorkspace(workspacePath, {
        include: params.include,
        exclude: params.exclude,
        objectTypes: params.object_types as any
      });

      // Build consumption info
      const consumptionInfo = this.buildConsumptionInfo(objects);

      // Detect collisions if requested
      let collisions: Collision[] | undefined;
      if (params.detect_collisions) {
        collisions = this.detectCollisions(objects);
      }

      // Map to pools if requested
      let poolMapping: any | undefined;
      if (params.map_to_pools) {
        poolMapping = await this.mapToPools(objects, workspacePath);
      }

      // Build result
      const result: AnalyzeWorkspaceResult = {
        summary: {
          total_objects: objects.length,
          by_type: consumptionInfo,
          collision_count: collisions?.length || 0,
          pool_count: poolMapping ? Object.keys(poolMapping).length : undefined
        }
      };

      // Add detailed info if requested
      if (params.return_level === 'detailed') {
        result.objects = objects.map(obj => ({
          type: obj.type,
          id: obj.id,
          name: obj.name,
          file: obj.file
        }));
        result.collisions = collisions;
        result.pool_mapping = poolMapping;
      }

      this.logger.info('Workspace analysis complete', {
        totalObjects: result.summary.total_objects,
        collisions: result.summary.collision_count
      });

      return result;
    } catch (error) {
      this.logger.error('Workspace analysis failed', error);
      throw this.createError(
        ErrorCode.BACKEND_ERROR,
        error instanceof Error ? error.message : 'Analysis failed'
      );
    }
  }

  /**
   * Build consumption info from objects
   */
  private buildConsumptionInfo(objects: ALObject[]): ConsumptionInfo {
    const info: ConsumptionInfo = {};
    const grouped = WorkspaceUtils.groupObjectsByType(objects);

    for (const [type, typeObjects] of Object.entries(grouped)) {
      const ids = typeObjects.map(obj => obj.id).sort((a, b) => a - b);
      const ranges = WorkspaceUtils.getConsumedRanges(typeObjects)[type] || [];

      info[type] = {
        count: typeObjects.length,
        ids: ids,
        ranges: ranges
      };
    }

    return info;
  }

  /**
   * Detect ID collisions
   */
  private detectCollisions(objects: ALObject[]): Collision[] {
    const collisions = WorkspaceUtils.findCollisions(objects);

    return collisions.map(c => ({
      type: c.type,
      id: c.id,
      objects: c.objects.map(obj => ({
        name: obj.name,
        file: obj.file
      }))
    }));
  }

  /**
   * Map objects to pools
   */
  private async mapToPools(objects: ALObject[], appPath: string): Promise<any> {
    // Load configuration to get pool info
    const config = await this.config.readObjIdConfig(appPath);
    if (!config) {
      return {};
    }

    const poolMapping: any = {};

    // If app has a pool ID, map all objects to it
    if (config.appPoolId) {
      poolMapping[config.appPoolId] = {
        name: `Pool ${config.appPoolId}`,
        objects: objects.map(obj => ({
          type: obj.type,
          id: obj.id,
          name: obj.name
        }))
      };
    } else {
      // Map to default pool
      poolMapping['default'] = {
        name: 'Default Pool',
        objects: objects.map(obj => ({
          type: obj.type,
          id: obj.id,
          name: obj.name
        }))
      };
    }

    // Try to get more pool info from backend if available
    try {
      const backendResult = await this.backend.analyzeWorkspace({
        appPath,
        return_level: 'summary',
        map_to_pools: true
      });

      if (backendResult.pool_mapping) {
        // Merge backend pool info
        Object.assign(poolMapping, backendResult.pool_mapping);
      }
    } catch (error) {
      // Backend pool mapping is optional, continue without it
      this.logger.debug('Could not get pool mapping from backend', error);
    }

    return poolMapping;
  }
}