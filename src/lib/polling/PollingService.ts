import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';
import { BackendService } from '../backend/BackendService';
import { WorkspaceManager, WorkspaceApp } from '../workspace/WorkspaceManager';
import { CollisionDetector } from '../collision/CollisionDetector';
import { ALObjectType } from '../types/ALObjectType';

export type UpdateEvent = {
  appId: string;
  timestamp: number;
} & (
  | {
      type: 'consumption';
      data: {
        objectType: string;
        ids: number[];
        count: number;
        previousCount: number;
      };
    }
  | {
      type: 'collision';
      data: {
        collisions: Array<unknown>;
        count: number;
      };
    }
  | {
      type: 'pool';
      poolId?: string;
      message?: string;
    }
  | {
      type: 'authorization';
      data: Record<string, unknown>;
    }
);

export interface PollingConfig {
  enabled: boolean;
  interval: number; // milliseconds
  checkConsumption: boolean;
  checkCollisions: boolean;
  checkPools: boolean;
}

export class PollingService extends EventEmitter {
  private static instance: PollingService;
  private logger: Logger;
  private backendService: BackendService;
  private workspaceManager: WorkspaceManager;
  private collisionDetector: CollisionDetector;
  private pollingTimer?: NodeJS.Timer;
  private config: PollingConfig;
  private lastPollTime: Map<string, number> = new Map();
  private lastPoolIds: Map<string, string> = new Map(); // Track pool IDs separately
  private isPolling = false;

  private constructor() {
    super();
    this.logger = Logger.getInstance();
    this.backendService = new BackendService();
    this.workspaceManager = WorkspaceManager.getInstance();
    this.collisionDetector = CollisionDetector.getInstance();

    this.config = {
      enabled: false,
      interval: 30000, // 30 seconds default
      checkConsumption: true,
      checkCollisions: true,
      checkPools: false
    };
  }

  static getInstance(): PollingService {
    if (!this.instance) {
      this.instance = new PollingService();
    }
    return this.instance;
  }

  /**
   * Start polling service
   */
  start(config?: Partial<PollingConfig>): void {
    if (this.pollingTimer) {
      this.stop();
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (!this.config.enabled) {
      this.logger.info('Polling service is disabled');
      return;
    }

    this.logger.info('Starting polling service', {
      interval: this.config.interval,
      features: {
        consumption: this.config.checkConsumption,
        collisions: this.config.checkCollisions,
        pools: this.config.checkPools
      }
    });

    // Initial poll
    this.poll();

    // Set up recurring poll
    this.pollingTimer = setInterval(() => {
      this.poll();
    }, this.config.interval);
  }

  /**
   * Stop polling service
   */
  stop(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer as unknown as NodeJS.Timeout);
      this.pollingTimer = undefined;
      this.logger.info('Polling service stopped');
    }
  }

  /**
   * Perform a single poll cycle
   */
  private async poll(): Promise<void> {
    if (this.isPolling) {
      this.logger.verbose('Skipping poll - previous poll still in progress');
      return;
    }

    this.isPolling = true;

    try {
      const workspace = this.workspaceManager.getCurrentWorkspace();
      if (!workspace) {
        return;
      }

      const promises: Promise<void>[] = [];

      for (const app of workspace.apps) {
        if (app.isAuthorized && app.authKey) {
          // Check consumption updates
          if (this.config.checkConsumption) {
            promises.push(this.checkConsumptionUpdates(app));
          }

          // Check for collisions
          if (this.config.checkCollisions) {
            promises.push(this.checkCollisionUpdates(app));
          }

          // Check pool updates
          if (this.config.checkPools) {
            promises.push(this.checkPoolUpdates(app));
          }
        }
      }

      await Promise.allSettled(promises);
    } catch (error) {
      this.logger.error('Polling error', error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Check for consumption updates
   */
  private async checkConsumptionUpdates(app: WorkspaceApp): Promise<void> {
    try {
      const now = Date.now();

      // Get all object types
      const objectTypes = [
        ALObjectType.Table,
        ALObjectType.Page,
        ALObjectType.Report,
        ALObjectType.Codeunit,
        ALObjectType.Query,
        ALObjectType.XmlPort,
        ALObjectType.Enum
      ];

      // Use pool ID if available (matches VSCode extension behavior)
      const workspace = WorkspaceManager.getInstance();
      const appId = workspace.getPoolIdFromAppIdIfAvailable(app.appId);

      const request = {
        appId,
        authKey: app.authKey || ''
      };

      const consumptionInfo = await this.backendService.getConsumption(request);

      if (consumptionInfo) {
        for (const objectType of objectTypes) {
          const consumption = consumptionInfo[objectType] || [];
          
          if (consumption.length > 0) {
            // Check if this is new or updated
            const cacheKey = `${app.appId}-${objectType}-consumption`;
            const cachedCount = this.lastPollTime.get(cacheKey) || 0;

            if (consumption.length !== cachedCount) {
              this.emit('update', {
                type: 'consumption',
                appId: app.appId,
                data: {
                  objectType,
                  ids: consumption,
                  count: consumption.length,
                  previousCount: cachedCount
                },
                timestamp: now
              } as UpdateEvent);

              this.lastPollTime.set(cacheKey, consumption.length);

              this.logger.info('Consumption update detected', {
                app: app.name,
                objectType,
                newCount: consumption.length,
                previousCount: cachedCount
              });
            }
          }
        }
      }

      this.lastPollTime.set(`${app.appId}-consumption`, now);
    } catch (error) {
      this.logger.error('Failed to check consumption updates', { app: app.name, error });
    }
  }

  /**
   * Check for collision updates
   */
  private async checkCollisionUpdates(app: WorkspaceApp): Promise<void> {
    try {
      const collisions = await this.collisionDetector.checkRangeOverlaps();

      if (collisions.length > 0) {
        // Filter collisions involving this app
        const appCollisions = collisions.filter(c =>
          c.apps.some(a => a.appId === app.appId)
        );

        if (appCollisions.length > 0) {
          this.emit('update', {
            type: 'collision',
            appId: app.appId,
            data: {
              collisions: appCollisions,
              count: appCollisions.length
            },
            timestamp: Date.now()
          } as UpdateEvent);

          this.logger.info('Collision detected', {
            app: app.name,
            collisionCount: appCollisions.length
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to check collision updates', { app: app.name, error });
    }
  }

  /**
   * Check for pool updates
   */
  private async checkPoolUpdates(app: WorkspaceApp): Promise<void> {
    try {
      // Use pool ID if available (matches VSCode extension behavior)
      const workspace = WorkspaceManager.getInstance();
      const appId = workspace.getPoolIdFromAppIdIfAvailable(app.appId);
      
      const checkResult = await this.backendService.checkApp(appId);

      if (checkResult.hasPool && checkResult.poolId) {
        const cacheKey = `${app.appId}-pool`;
        const cachedPoolId = this.lastPoolIds.get(cacheKey);

        // Convert poolId to string for comparison
        const poolIdStr = String(checkResult.poolId);

        if (cachedPoolId !== poolIdStr) {
          this.emit('update', {
            type: 'pool',
            appId: app.appId,
            poolId: checkResult.poolId,
            message: `App joined pool: ${checkResult.poolId}`,
            timestamp: Date.now()
          } as UpdateEvent);

          this.lastPoolIds.set(cacheKey, poolIdStr);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to check pool updates for app ${app.appId}`, error);
    }
  }

  /**
   * Force an immediate poll
   */
  async pollNow(): Promise<void> {
    this.logger.info('Forcing immediate poll');
    await this.poll();
  }

  /**
   * Update polling configuration
   */
  updateConfig(config: Partial<PollingConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    // Restart if enabled state changed
    if (wasEnabled !== this.config.enabled) {
      if (this.config.enabled) {
        this.start();
      } else {
        this.stop();
      }
    } else if (this.config.enabled && config.interval !== undefined) {
      // Restart with new interval
      this.start();
    }

    this.logger.info('Polling configuration updated', this.config);
  }

  /**
   * Get current polling status
   */
  getStatus(): {
    enabled: boolean;
    isPolling: boolean;
    interval: number;
    lastPollTimes: Record<string, number>;
  } {
    return {
      enabled: this.config.enabled,
      isPolling: this.isPolling,
      interval: this.config.interval,
      lastPollTimes: Object.fromEntries(this.lastPollTime)
    };
  }

  /**
   * Clear all cached poll times
   */
  clearCache(): void {
    this.lastPollTime.clear();
    this.lastPoolIds.clear();
    this.logger.info('Polling cache cleared');
  }
}