/**
 * Log Tool - Retrieves activity logs from backend
 */

import { BaseTool } from '../base/BaseTool';
import { logSchema, LogInput } from '../../lib/validation/standardSchemas';
import { LogParams, LogResult } from '../../lib/types/tools/standard';
import { BackendService } from '../../lib/backend/BackendService';
import { ConfigManager } from '../../lib/config/ConfigManager';
import { ErrorCode } from '../../lib/errors/codes';
import { Logger } from '../../lib/utils/logger';

export class LogTool extends BaseTool<LogParams, LogResult> {
  private backend: BackendService;
  private config: ConfigManager;
  private logger: Logger;

  constructor() {
    super(
      'log',
      'Retrieve activity logs and audit trail. REQUIRES appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/app.json". Optional: limit (number, 1-1000, default: 100), since (ISO 8601 datetime string), until (ISO 8601 datetime string), filter ({event_type?:string, object_type?:string, user?:string}).',
      logSchema
    );
    this.config = ConfigManager.getInstance();
    const serverConfig = this.config.getServerConfig();
    this.backend = new BackendService(serverConfig.backendUrl, serverConfig.backendApiKey);
    this.logger = Logger.getInstance();
  }

  protected async executeInternal(params: LogInput): Promise<LogResult> {
    this.logger.info('Retrieving activity logs', {
      appPath: params.appPath,
      limit: params.limit
    });

    // Validate app path and get app info
    const appInfo = await this.config.readAppJson(params.appPath);
    if (!appInfo.id) {
      throw this.createError(
        ErrorCode.APP_NOT_FOUND,
        'Invalid app.json file'
      );
    }

    try {
      // Get logs from backend
      const logData = await this.backend.getLogs({
        appPath: params.appPath,
        appId: appInfo.id as string,
        limit: params.limit,
        startDate: params.since,
        endDate: params.until
      });

      // Process and format log entries (GetLogsResult has 'logs', not 'entries')
      const entries = (logData.logs || []).map((entry: any) => ({
        timestamp: entry.timestamp,
        event_type: entry.eventType || entry.type,
        object_type: entry.objectType,
        object_id: entry.objectId,
        user: entry.user || entry.gitUser,
        details: entry.details || {
          message: entry.message,
          ...entry.metadata
        }
      }));

      // Apply client-side filtering if needed
      let filtered = entries;
      if (params.filter) {
        filtered = entries.filter((entry: any) => {
          if (params.filter!.event_type && entry.event_type !== params.filter!.event_type) {
            return false;
          }
          if (params.filter!.object_type && entry.object_type !== params.filter!.object_type) {
            return false;
          }
          if (params.filter!.user && entry.user !== params.filter!.user) {
            return false;
          }
          return true;
        });
      }

      // Apply date range filtering
      if (params.since) {
        const sinceDate = new Date(params.since);
        filtered = filtered.filter((entry: any) =>
          new Date(entry.timestamp) >= sinceDate
        );
      }

      if (params.until) {
        const untilDate = new Date(params.until);
        filtered = filtered.filter((entry: any) =>
          new Date(entry.timestamp) <= untilDate
        );
      }

      // Sort by timestamp (most recent first)
      filtered.sort((a: any, b: any) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Apply limit
      const limited = filtered.slice(0, params.limit);

      this.logger.info('Activity logs retrieved', {
        total: entries.length,
        filtered: filtered.length,
        returned: limited.length
      });

      return {
        entries: limited,
        total: entries.length,
        filtered: filtered.length
      };
    } catch (error) {
      this.logger.error('Failed to retrieve activity logs', error);
      throw error;
    }
  }
}