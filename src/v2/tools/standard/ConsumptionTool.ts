/**
 * Consumption Tool - Provides detailed consumption tracking
 */

import { BaseTool } from '../base/BaseTool';
import { consumptionSchema, ConsumptionInput } from '../../lib/validation/standardSchemas';
import { ConsumptionParams, ConsumptionResult } from '../../lib/types/tools/standard';
import { BackendService } from '../../lib/backend/BackendService';
import { ConfigManager } from '../../lib/config/ConfigManager';
import { WorkspaceUtils } from '../../lib/utils/workspace';
import { ErrorCode } from '../../lib/errors/codes';
import { Logger } from '../../lib/utils/logger';

export class ConsumptionTool extends BaseTool<ConsumptionParams, ConsumptionResult> {
  private backend: BackendService;
  private config: ConfigManager;
  private logger: Logger;

  constructor() {
    super(
      'consumption',
      'Get detailed consumption statistics and available IDs. REQUIRES appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/app.json". Optional: object_type (string), detailed (boolean, default: false), include_available (boolean, default: false).',
      consumptionSchema
    );
    this.config = ConfigManager.getInstance();
    const serverConfig = this.config.getServerConfig();
    this.backend = new BackendService(serverConfig.backendUrl, serverConfig.backendApiKey);
    this.logger = Logger.getInstance();
  }

  protected async executeInternal(params: ConsumptionInput): Promise<ConsumptionResult> {
    this.logger.info('Getting consumption data', { appPath: params.appPath });

    // Validate app path
    const validation = await WorkspaceUtils.validateAppPath(params.appPath);
    if (!validation.valid) {
      throw this.createError(
        ErrorCode.APP_NOT_FOUND,
        validation.reason || 'Invalid app path'
      );
    }

    try {
      // Get consumption from backend
      const backendData = await this.backend.getConsumption({
        appPath: params.appPath,
        detailed: params.detailed,
        objectType: params.object_type as any // Backend expects string
      });

      // Build result
      const result: ConsumptionResult = {
        summary: {
          total_consumed: 0,
          by_type: {}
        }
      };

      // Process consumption data (GetConsumptionResponse extends ObjectConsumptions)
      // ObjectConsumptions is { [key in ALObjectType]?: number[] }
      for (const [type, ids] of Object.entries(backendData)) {
        if (type === '_appInfo') continue; // Skip metadata fields
        if (Array.isArray(ids)) {
          result.summary.by_type[type] = ids.length;
          result.summary.total_consumed += ids.length;

          if (params.detailed) {
            if (!result.details) {
              result.details = [];
            }
            for (const id of ids) {
              result.details.push({
                type,
                id: typeof id === 'number' ? id : (id as any).id,
                consumed_at: (id as any).consumedAt
              });
            }
          }
        }
      }

      // Add last updated timestamp if available
      if ((backendData as any)._appInfo?.lastUpdated) {
        result.summary.last_updated = (backendData as any)._appInfo.lastUpdated;
      }

      // Get available IDs if requested
      if (params.include_available) {
        const config = await this.config.readConfig(params.appPath);
        result.available = {};

        // Calculate available IDs for each type using objectRanges
        if (config.objectRanges) {
          for (const [type, ranges] of Object.entries(config.objectRanges)) {
            const consumed = (backendData as any)[type] || [];
            const consumedSet = new Set(
              Array.isArray(consumed) ? consumed.map((id: any) => typeof id === 'number' ? id : id.id) : []
            );

            result.available[type] = [];
            for (const range of ranges) {
              for (let id = range.from; id <= range.to; id++) {
                if (!consumedSet.has(id)) {
                  result.available[type].push(id);
                }
              }
            }
          }
        }
      }

      this.logger.info('Consumption data retrieved', {
        total: result.summary.total_consumed,
        types: Object.keys(result.summary.by_type).length
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to get consumption data', error);
      throw error;
    }
  }
}