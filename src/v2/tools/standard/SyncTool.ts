/**
 * Sync Tool - Manages ID synchronization with backend
 */

import { BaseTool } from '../base/BaseTool';
import { syncSchema, SyncInput } from '../../lib/validation/standardSchemas';
import { SyncParams, SyncResult } from '../../lib/types/tools/standard';
import { BackendService } from '../../lib/backend/BackendService';
import { ConfigManager } from '../../lib/config/ConfigManager';
import { WorkspaceUtils } from '../../lib/utils/workspace';
import { ErrorCode, StandardErrorCode } from '../../lib/errors/codes';
import { Logger } from '../../lib/utils/logger';

export class SyncTool extends BaseTool<SyncParams, SyncResult> {
  private backend: BackendService;
  private config: ConfigManager;
  private logger: Logger;

  constructor() {
    super(
      'sync',
      'Synchronize object IDs with backend service. REQUIRES action ("sync"|"auto-sync"|"check-status"), appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/app.json". Optional: mode ("full"|"incremental", default: "incremental"), force (boolean, default: false), dry_run (boolean, default: false).',
      syncSchema
    );
    this.config = ConfigManager.getInstance();
    const serverConfig = this.config.getServerConfig();
    this.backend = new BackendService(serverConfig.backendUrl, serverConfig.backendApiKey);
    this.logger = Logger.getInstance();
  }

  protected async executeInternal(params: SyncInput): Promise<SyncResult> {
    this.logger.info(`Sync action: ${params.action}`, { appPath: params.appPath });

    // Validate app path
    const validation = await WorkspaceUtils.validateAppPath(params.appPath);
    if (!validation.valid) {
      throw this.createError(
        ErrorCode.APP_NOT_FOUND,
        validation.reason || 'Invalid app path'
      );
    }

    try {
      switch (params.action) {
        case 'sync':
          return await this.performSync(params);

        case 'auto-sync':
          return await this.setupAutoSync(params);

        case 'check-status':
          return await this.checkSyncStatus(params);

        default:
          throw this.createError(
            ErrorCode.INVALID_PARAMETER,
            `Unknown sync action: ${params.action}`
          );
      }
    } catch (error) {
      this.logger.error(`Sync operation failed: ${params.action}`, error);
      throw error;
    }
  }

  private async performSync(params: SyncInput): Promise<SyncResult> {
    this.logger.info('Performing synchronization', {
      mode: params.mode,
      dryRun: params.dry_run
    });

    // Scan workspace for AL objects
    const objects = await WorkspaceUtils.scanALObjects(params.appPath);

    // Get current consumption from backend
    const backendData = await this.backend.getConsumption({
      appPath: params.appPath,
      detailed: true
    });

    // Calculate differences
    const localIds = new Map<string, Set<number>>();
    const remoteIds = new Map<string, Set<number>>();

    // Build local ID map
    for (const obj of objects) {
      if (!localIds.has(obj.type)) {
        localIds.set(obj.type, new Set());
      }
      localIds.get(obj.type)!.add(obj.id);
    }

    // Build remote ID map (GetConsumptionResponse extends ObjectConsumptions)
    for (const [type, ids] of Object.entries(backendData)) {
      if (type === '_appInfo' || !Array.isArray(ids)) continue;
      remoteIds.set(type, new Set(
        ids.map(id => typeof id === 'number' ? id : (id as any).id)
      ));
    }

    // Find differences
    const toAdd: Array<{type: string, id: number}> = [];
    const toRemove: Array<{type: string, id: number}> = [];
    const conflicts: SyncResult['conflicts'] = [];

    // Find IDs to add (in local but not remote)
    for (const [type, ids] of localIds) {
      const remote = remoteIds.get(type) || new Set();
      for (const id of ids) {
        if (!remote.has(id)) {
          toAdd.push({ type, id });
        }
      }
    }

    // Find IDs to remove (in remote but not local) - only in full mode
    if (params.mode === 'full') {
      for (const [type, ids] of remoteIds) {
        const local = localIds.get(type) || new Set();
        for (const id of ids) {
          if (!local.has(id)) {
            toRemove.push({ type, id });
          }
        }
      }
    }

    // Check for conflicts
    const config = await this.config.readConfig(params.appPath);
    if (config.idRanges) {
      for (const { type, id } of toAdd) {
        const ranges = config.idRanges[type];
        if (ranges) {
          const inRange = ranges.some((r: any) => id >= r.from && id <= r.to);
          if (!inRange) {
            conflicts.push({
              type,
              id,
              local_state: 'present',
              remote_state: 'missing',
              resolution: 'Out of configured range'
            });
          }
        }
      }
    }

    // Perform sync if not dry run
    let synced = false;
    if (!params.dry_run && (toAdd.length > 0 || toRemove.length > 0)) {
      if (!params.force && conflicts.length > 0) {
        throw this.createError(
          StandardErrorCode.SYNC_CONFLICT as any,
          'Conflicts detected. Use force flag to override.'
        );
      }

      // Sync with backend
      const syncResult = await this.backend.syncIds({
        appPath: params.appPath,
        ids: Object.fromEntries(
          Array.from(localIds.entries()).map(([type, ids]) => [type, Array.from(ids)])
        ),
        clear: params.mode === 'full'
      });

      synced = syncResult.success;
    }

    return {
      action: 'sync',
      synced: !params.dry_run && synced,
      mode: params.mode,
      stats: {
        objects_synced: objects.length,
        objects_added: toAdd.length,
        objects_removed: toRemove.length,
        conflicts_resolved: params.force ? conflicts.length : 0
      },
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      message: params.dry_run
        ? `Dry run complete: ${toAdd.length} to add, ${toRemove.length} to remove`
        : `Sync complete: ${toAdd.length} added, ${toRemove.length} removed`
    };
  }

  private async setupAutoSync(params: SyncInput): Promise<SyncResult> {
    // Store auto-sync configuration
    const config = await this.config.readConfig(params.appPath);

    const updatedConfig = {
      ...config,
      autoSync: {
        enabled: true,
        mode: params.mode,
        lastSync: new Date().toISOString()
      }
    };

    await this.config.writeConfig(params.appPath, updatedConfig);

    return {
      action: 'auto-sync',
      synced: true,
      mode: params.mode,
      message: `Auto-sync enabled with ${params.mode} mode`
    };
  }

  private async checkSyncStatus(params: SyncInput): Promise<SyncResult> {
    // Get config to check auto-sync status (not used but kept for future)
    await this.config.readConfig(params.appPath);

    // Get workspace objects
    const objects = await WorkspaceUtils.scanALObjects(params.appPath);

    // Get backend consumption
    const backendData = await this.backend.getConsumption({
      appPath: params.appPath,
      detailed: false
    });

    // Calculate if in sync
    const totalLocal = objects.length;
    let totalRemote = 0;

    // Count remote IDs (GetConsumptionResponse extends ObjectConsumptions)
    for (const [type, ids] of Object.entries(backendData)) {
      if (type === '_appInfo' || !Array.isArray(ids)) continue;
      totalRemote += ids.length;
    }

    const inSync = totalLocal === totalRemote;

    return {
      action: 'check-status',
      synced: inSync,
      stats: {
        objects_synced: inSync ? totalLocal : 0,
        objects_added: 0,
        objects_removed: 0,
        conflicts_resolved: 0
      },
      message: inSync
        ? 'Workspace is in sync with backend'
        : `Out of sync: ${totalLocal} local, ${totalRemote} remote objects`
    };
  }
}