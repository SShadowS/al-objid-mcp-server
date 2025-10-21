/**
 * Config Tool for LITE mode
 */

import { BaseTool } from '../base/BaseTool';
import { configSchema } from '../../lib/validation/schemas';
import { ConfigParams, ConfigResult } from '../../lib/types/tools/lite';
import { ConfigManager } from '../../lib/config/ConfigManager';
import { WorkspaceUtils } from '../../lib/utils/workspace';
import { Logger } from '../../lib/utils/logger';
import { ErrorCode } from '../../lib/types/common/errors';

/**
 * Configuration tool for managing .objidconfig files
 */
export class ConfigTool extends BaseTool<ConfigParams, ConfigResult> {
  private config: ConfigManager;
  private logger: Logger;

  constructor() {
    super(
      'config',
      'Read, write, and validate .objidconfig configuration files. REQUIRES action ("read"|"write"|"validate"), appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/.objidconfig". Optional: keys (string[], read only), patch (object, write only), merge (boolean, write only, default: true), schema_version (string).',
      configSchema
    );

    this.config = ConfigManager.getInstance();
    this.logger = Logger.getInstance();
  }

  protected async executeInternal(params: ConfigParams): Promise<ConfigResult> {
    this.logger.info(`Config action: ${params.action}`, { appPath: params.appPath });

    // Validate app path
    const validation = await WorkspaceUtils.validateAppPath(params.appPath);
    if (!validation.valid) {
      throw this.createError(
        ErrorCode.APP_NOT_FOUND,
        validation.reason || 'Invalid app path'
      );
    }

    switch (params.action) {
      case 'read':
        return this.handleRead(params);
      case 'write':
        return this.handleWrite(params);
      case 'validate':
        return this.handleValidate(params);
      default:
        throw this.createError(
          ErrorCode.INVALID_ACTION,
          `Unknown config action: ${params.action}`
        );
    }
  }

  /**
   * Handle read action
   */
  private async handleRead(params: ConfigParams): Promise<ConfigResult> {
    try {
      const config = await this.config.readObjIdConfig(params.appPath);

      if (!config) {
        return {
          action: 'read',
          exists: false,
          valid: false,
          validation: [{
            path: '.objidconfig',
            message: 'Configuration file not found',
            severity: 'error'
          }]
        };
      }

      // Filter by keys if specified
      let filteredConfig = config;
      if (params.keys && params.keys.length > 0) {
        filteredConfig = {} as any;
        for (const key of params.keys) {
          if (key in config) {
            (filteredConfig as any)[key] = (config as any)[key];
          }
        }
      }

      return {
        action: 'read',
        config: filteredConfig,
        exists: true,
        valid: true
      };
    } catch (error) {
      this.logger.error('Failed to read config', error);
      throw this.createError(
        ErrorCode.CONFIG_INVALID,
        error instanceof Error ? error.message : 'Failed to read config'
      );
    }
  }

  /**
   * Handle write action
   */
  private async handleWrite(params: ConfigParams): Promise<ConfigResult> {
    if (!params.patch) {
      throw this.createError(
        ErrorCode.INVALID_PARAMETER,
        'patch parameter is required for write action'
      );
    }

    try {
      await this.config.writeObjIdConfig(
        params.appPath,
        params.patch as any,
        params.merge ?? true
      );

      // Read back the written config
      const config = await this.config.readObjIdConfig(params.appPath);

      return {
        action: 'write',
        config: config || params.patch,
        exists: true,
        valid: true
      };
    } catch (error) {
      this.logger.error('Failed to write config', error);
      throw this.createError(
        ErrorCode.CONFIG_WRITE_ERROR,
        error instanceof Error ? error.message : 'Failed to write config'
      );
    }
  }

  /**
   * Handle validate action
   */
  private async handleValidate(params: ConfigParams): Promise<ConfigResult> {
    try {
      const config = await this.config.readObjIdConfig(params.appPath);

      if (!config) {
        return {
          action: 'validate',
          exists: false,
          valid: false,
          validation: [{
            path: '.objidconfig',
            message: 'Configuration file not found',
            severity: 'error'
          }]
        };
      }

      // Validate configuration
      const validation: Array<{
        path: string;
        message: string;
        severity: 'error' | 'warning' | 'info';
      }> = [];

      // Check for required fields - need either idRanges (array) or objectRanges (object)
      const hasIdRanges = Array.isArray(config.idRanges) && config.idRanges.length > 0;
      const hasObjectRanges = config.objectRanges && Object.keys(config.objectRanges).length > 0;

      if (!hasIdRanges && !hasObjectRanges) {
        validation.push({
          path: 'idRanges',
          message: 'No ID ranges defined (need idRanges array or objectRanges object)',
          severity: 'error'
        });
      }

      // Validate objectRanges
      if (config.objectRanges) {
        for (const [type, ranges] of Object.entries(config.objectRanges)) {
          if (!Array.isArray(ranges) || ranges.length === 0) {
            validation.push({
              path: `objectRanges.${type}`,
              message: 'No ranges defined for type',
              severity: 'warning'
            });
            continue;
          }

          // Check for overlapping ranges
          for (let i = 0; i < ranges.length; i++) {
            for (let j = i + 1; j < ranges.length; j++) {
              const r1 = ranges[i];
              const r2 = ranges[j];
              if (r1.from <= r2.to && r2.from <= r1.to) {
                validation.push({
                  path: `objectRanges.${type}`,
                  message: `Overlapping ranges detected: [${r1.from}-${r1.to}] and [${r2.from}-${r2.to}]`,
                  severity: 'error'
                });
              }
            }
          }
        }
      }

      // Check optional fields
      if (config.bcLicense) {
        // Could validate license file exists
        validation.push({
          path: 'bcLicense',
          message: 'License file configured',
          severity: 'info'
        });
      }

      if (config.appPoolId) {
        validation.push({
          path: 'appPoolId',
          message: `App pool configured: ${config.appPoolId}`,
          severity: 'info'
        });
      }

      const valid = !validation.some(v => v.severity === 'error');

      return {
        action: 'validate',
        config,
        exists: true,
        valid,
        validation: validation.length > 0 ? validation : undefined
      };
    } catch (error) {
      this.logger.error('Failed to validate config', error);
      return {
        action: 'validate',
        exists: false,
        valid: false,
        validation: [{
          path: '.objidconfig',
          message: error instanceof Error ? error.message : 'Validation failed',
          severity: 'error'
        }]
      };
    }
  }
}