import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { AppJsonManifest, ObjIdConfigFile, RangeInput, ParsedRange } from '../types/WorkspaceTypes';

export interface WorkspaceApp {
  path: string;
  appId: string;
  name: string;
  version: string;
  publisher: string;
  hasObjIdConfig: boolean;
  isAuthorized: boolean;
  authKey?: string;
  appPoolId?: string;
  ranges?: Array<{ from: number; to: number }>;
}

export interface WorkspaceInfo {
  rootPath: string;
  apps: WorkspaceApp[];
  activeApp?: WorkspaceApp;
}

export class WorkspaceManager {
  private static instance: WorkspaceManager;
  private logger: Logger;
  private workspaces: Map<string, WorkspaceInfo> = new Map();
  private currentWorkspace?: string;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  static getInstance(): WorkspaceManager {
    if (!this.instance) {
      this.instance = new WorkspaceManager();
    }
    return this.instance;
  }

  /**
   * Scan a directory for AL apps (folders containing app.json)
   */
  async scanWorkspace(workspacePath: string): Promise<WorkspaceInfo> {
    this.logger.verbose('Scanning workspace', { path: workspacePath });

    const workspace: WorkspaceInfo = {
      rootPath: workspacePath,
      apps: []
    };

    // Check if the workspace itself is an AL app
    if (await this.isALApp(workspacePath)) {
      const app = await this.loadAppInfo(workspacePath);
      if (app) {
        workspace.apps.push(app);
      }
    }

    // Scan subdirectories for AL apps
    try {
      const entries = await fs.promises.readdir(workspacePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subPath = path.join(workspacePath, entry.name);

          if (await this.isALApp(subPath)) {
            const app = await this.loadAppInfo(subPath);
            if (app) {
              workspace.apps.push(app);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error scanning workspace', error);
    }

    // Sort apps by name for consistent ordering
    workspace.apps.sort((a, b) => a.name.localeCompare(b.name));

    // Set the first app as active if there's only one
    if (workspace.apps.length === 1) {
      workspace.activeApp = workspace.apps[0];
    }

    this.workspaces.set(workspacePath, workspace);
    this.currentWorkspace = workspacePath;

    this.logger.info(`Found ${workspace.apps.length} AL app(s) in workspace`, {
      workspace: workspacePath,
      apps: workspace.apps.map(a => ({ name: a.name, path: a.path }))
    });

    return workspace;
  }

  /**
   * Check if a directory contains an AL app (has app.json)
   */
  private async isALApp(dirPath: string): Promise<boolean> {
    const appJsonPath = path.join(dirPath, 'app.json');
    try {
      const stats = await fs.promises.stat(appJsonPath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Load app information from app.json and .objidconfig
   */
  private async loadAppInfo(appPath: string): Promise<WorkspaceApp | null> {
    try {
      // Load app.json
      const appJsonPath = path.join(appPath, 'app.json');
      const appJsonContent = await fs.promises.readFile(appJsonPath, 'utf-8');
      const appJson = JSON.parse(appJsonContent) as AppJsonManifest;

      // Check for .objidconfig
      const objIdConfigPath = path.join(appPath, '.objidconfig');
      let hasObjIdConfig = false;
      let authKey: string | undefined;
      let appPoolId: string | undefined;
      let ranges: Array<{ from: number; to: number }> | undefined;

      try {
        const stats = await fs.promises.stat(objIdConfigPath);
        if (stats.isFile()) {
          hasObjIdConfig = true;

          // Load .objidconfig to get auth key, appPoolId and ranges
          const objIdConfigContent = await fs.promises.readFile(objIdConfigPath, 'utf-8');
          try {
            // Remove comments for JSON parsing
            const jsonContent = objIdConfigContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
            const objIdConfig = JSON.parse(jsonContent) as ObjIdConfigFile;

            authKey = objIdConfig.authKey;
            appPoolId = objIdConfig.appPoolId;

            // Extract ranges from config
            if (objIdConfig.ranges) {
              ranges = this.parseRanges(objIdConfig.ranges);
            } else if (objIdConfig.idRanges) {
              // Support legacy format
              ranges = [];
              for (const typeRanges of Object.values(objIdConfig.idRanges)) {
                if (Array.isArray(typeRanges)) {
                  ranges.push(...this.parseRanges(typeRanges));
                }
              }
            }
          } catch (error) {
            this.logger.error('Error parsing .objidconfig', { path: objIdConfigPath, error });
          }
        }
      } catch {
        // .objidconfig doesn't exist
      }

      // Generate app ID from the app.json id field (GUID) - matching VS Code extension
      const { getSha256 } = await import('../utils/crypto');
      const appId = getSha256(appJson.id);

      const app: WorkspaceApp = {
        path: appPath,
        appId,
        name: appJson.name || 'Unknown',
        version: appJson.version || '1.0.0.0',
        publisher: appJson.publisher || 'Unknown',
        hasObjIdConfig,
        isAuthorized: !!authKey,
        authKey,
        appPoolId,
        ranges: ranges || this.extractRangesFromAppJson(appJson)
      };

      return app;
    } catch (error) {
      this.logger.error('Error loading app info', { path: appPath, error });
      return null;
    }
  }

  /**
   * Parse range strings into structured format
   */
  private parseRanges(ranges: RangeInput[]): ParsedRange[] {
    const result: ParsedRange[] = [];

    if (!Array.isArray(ranges)) {
      return result;
    }

    for (const range of ranges) {
      if (typeof range === 'string') {
        // Parse string format like "50000..50099"
        const match = range.match(/(\d+)\.\.(\d+)/);
        if (match) {
          result.push({
            from: parseInt(match[1]),
            to: parseInt(match[2])
          });
        }
      } else if (typeof range === 'object' && range.from && range.to) {
        result.push({
          from: range.from,
          to: range.to
        });
      }
    }

    return result;
  }

  /**
   * Extract ID ranges from app.json
   */
  private extractRangesFromAppJson(appJson: AppJsonManifest): ParsedRange[] {
    const ranges: ParsedRange[] = [];

    // Check for idRanges in app.json
    if (appJson.idRanges && Array.isArray(appJson.idRanges)) {
      for (const range of appJson.idRanges) {
        if (range.from && range.to) {
          ranges.push({
            from: range.from,
            to: range.to
          });
        }
      }
    }

    // Check for idRange (single range)
    if (appJson.idRange && appJson.idRange.from && appJson.idRange.to) {
      ranges.push({
        from: appJson.idRange.from,
        to: appJson.idRange.to
      });
    }

    return ranges;
  }

  /**
   * Get the current workspace
   */
  getCurrentWorkspace(): WorkspaceInfo | undefined {
    if (!this.currentWorkspace) {
      return undefined;
    }
    return this.workspaces.get(this.currentWorkspace);
  }

  /**
   * Set the active app in the current workspace
   */
  setActiveApp(appPath: string): boolean {
    const workspace = this.getCurrentWorkspace();
    if (!workspace) {
      return false;
    }

    const app = workspace.apps.find(a => a.path === appPath);
    if (app) {
      workspace.activeApp = app;
      this.logger.info('Active app changed', { app: app.name, path: app.path });
      return true;
    }

    return false;
  }

  /**
   * Get app by path
   */
  getAppByPath(appPath: string): WorkspaceApp | undefined {
    for (const workspace of this.workspaces.values()) {
      const app = workspace.apps.find(a => a.path === appPath);
      if (app) {
        return app;
      }
    }
    return undefined;
  }

  /**
   * Find the app that contains a given file path
   */
  getAppForFile(filePath: string): WorkspaceApp | undefined {
    const normalizedPath = path.normalize(filePath);

    for (const workspace of this.workspaces.values()) {
      for (const app of workspace.apps) {
        const normalizedAppPath = path.normalize(app.path);
        if (normalizedPath.startsWith(normalizedAppPath)) {
          return app;
        }
      }
    }

    return undefined;
  }

  /**
   * Update app authorization
   */
  updateAppAuthorization(appPath: string, authKey: string): void {
    const app = this.getAppByPath(appPath);
    if (app) {
      app.authKey = authKey;
      app.isAuthorized = true;
      this.logger.info('App authorization updated', { app: app.name });
    }
  }

  /**
   * Get pool ID from app ID if available, matching VSCode extension behavior
   */
  getPoolIdFromAppIdIfAvailable(appId: string): string {
    const app = this.getAppById(appId);
    if (!app) {
      return appId;
    }
    
    const { appPoolId } = app;
    if (!appPoolId) {
      return appId;
    }

    if (appPoolId.length !== 64 || !/[0-9A-Fa-f]{6}/g.test(appPoolId)) {
      this.logger.error('Invalid appPoolId format', { app: app.name, appPoolId });
      return appId;
    }

    return appPoolId;
  }

  /**
   * Get app by app ID
   */
  getAppById(appId: string): WorkspaceApp | undefined {
    for (const workspace of this.workspaces.values()) {
      const app = workspace.apps.find(a => a.appId === appId);
      if (app) {
        return app;
      }
    }
    return undefined;
  }

  /**
   * Clear all workspaces
   */
  clear(): void {
    this.workspaces.clear();
    this.currentWorkspace = undefined;
  }
}