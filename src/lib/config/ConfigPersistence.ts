import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { WorkspaceApp } from '../workspace/WorkspaceManager';
import { DEFAULT_EXTENSION_RANGES } from '../constants/ranges';

export interface PersistedConfig {
  version: string;
  lastUpdated: number;
  workspaces: {
    [path: string]: {
      apps: Array<{
        appId: string;
        name: string;
        authKey?: string;
        ranges?: Array<{ from: number; to: number }>;
        lastAuthorized?: number;
      }>;
      activeAppId?: string;
    };
  };
  polling: {
    enabled: boolean;
    interval: number;
    checkConsumption: boolean;
    checkCollisions: boolean;
    checkPools: boolean;
  };
  assignments: {
    history: Array<{
      timestamp: number;
      appId: string;
      objectType: string;
      ids: number[];
      description?: string;
    }>;
    patterns: {
      [appId: string]: {
        [objectType: string]: {
          preferredRanges?: Array<{ from: number; to: number }>;
          namingPattern?: string;
          lastUsedId?: number;
        };
      };
    };
  };
  preferences: {
    defaultRanges?: Array<{ from: number; to: number }>;
    autoSync?: boolean;
    collisionChecking?: boolean;
    suggestAlternatives?: boolean;
    logLevel?: string;
  };
}

export class ConfigPersistence {
  private static instance: ConfigPersistence;
  private logger: Logger;
  private configPath: string;
  private config: PersistedConfig;
  private saveTimer?: NodeJS.Timeout;
  private isDirty = false;

  private constructor() {
    this.logger = Logger.getInstance();

    // Determine config path based on platform
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const configDir = path.join(homeDir, '.objid-mcp');

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    this.configPath = path.join(configDir, 'config.json');
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigPersistence {
    if (!this.instance) {
      this.instance = new ConfigPersistence();
    }
    return this.instance;
  }

  /**
   * Load configuration from disk
   */
  private loadConfig(): PersistedConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(content) as PersistedConfig;

        // Migrate old versions if needed
        if (this.needsMigration(loaded)) {
          return this.migrateConfig(loaded);
        }

        this.logger.info('Configuration loaded', { path: this.configPath });
        return loaded;
      }
    } catch (error) {
      this.logger.error('Failed to load configuration', error);
    }

    // Return default configuration
    return this.getDefaultConfig();
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): PersistedConfig {
    return {
      version: '1.0.0',
      lastUpdated: Date.now(),
      workspaces: {},
      polling: {
        enabled: false,
        interval: 30000,
        checkConsumption: true,
        checkCollisions: true,
        checkPools: false
      },
      assignments: {
        history: [],
        patterns: {}
      },
      preferences: {
        defaultRanges: DEFAULT_EXTENSION_RANGES,
        autoSync: true,
        collisionChecking: true,
        suggestAlternatives: true,
        logLevel: 'info'
      }
    };
  }

  /**
   * Check if configuration needs migration
   */
  private needsMigration(config: unknown): boolean {
    const cfg = config as { version?: string };
    return !cfg.version || cfg.version < '1.0.0';
  }

  /**
   * Migrate configuration to current version
   */
  private migrateConfig(oldConfig: unknown): PersistedConfig {
    this.logger.info('Migrating configuration to current version');

    const newConfig = this.getDefaultConfig();
    const old = oldConfig as Partial<PersistedConfig>;

    // Preserve any existing data that's still valid
    if (old.workspaces) {
      newConfig.workspaces = old.workspaces;
    }

    if (old.polling) {
      Object.assign(newConfig.polling, old.polling);
    }

    if (old.assignments) {
      Object.assign(newConfig.assignments, old.assignments);
    }

    if (old.preferences) {
      Object.assign(newConfig.preferences, old.preferences);
    }

    return newConfig;
  }

  /**
   * Save configuration to disk
   */
  private saveConfig(): void {
    try {
      this.config.lastUpdated = Date.now();
      const content = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, content, 'utf-8');
      this.isDirty = false;
      this.logger.verbose('Configuration saved', { path: this.configPath });
    } catch (error) {
      this.logger.error('Failed to save configuration', error);
    }
  }

  /**
   * Schedule a configuration save
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.isDirty = true;
    this.saveTimer = setTimeout(() => {
      if (this.isDirty) {
        this.saveConfig();
      }
    }, 1000); // Save after 1 second of inactivity
  }

  /**
   * Save workspace configuration
   */
  saveWorkspace(
    workspacePath: string,
    apps: WorkspaceApp[],
    activeAppId?: string
  ): void {
    this.config.workspaces[workspacePath] = {
      apps: apps.map(app => ({
        appId: app.appId,
        name: app.name,
        authKey: app.authKey,
        ranges: app.ranges,
        lastAuthorized: app.isAuthorized ? Date.now() : undefined
      })),
      activeAppId
    };

    this.scheduleSave();
  }

  /**
   * Get workspace configuration
   */
  getWorkspace(workspacePath: string): PersistedConfig['workspaces'][string] | undefined {
    return this.config.workspaces[workspacePath];
  }

  /**
   * Save polling configuration
   */
  savePollingConfig(config: PersistedConfig['polling']): void {
    this.config.polling = { ...config };
    this.scheduleSave();
  }

  /**
   * Get polling configuration
   */
  getPollingConfig(): PersistedConfig['polling'] {
    return { ...this.config.polling };
  }

  /**
   * Add assignment to history
   */
  addAssignmentHistory(
    appId: string,
    objectType: string,
    ids: number[],
    description?: string
  ): void {
    this.config.assignments.history.push({
      timestamp: Date.now(),
      appId,
      objectType,
      ids,
      description
    });

    // Keep only last 500 entries
    if (this.config.assignments.history.length > 500) {
      this.config.assignments.history = this.config.assignments.history.slice(-500);
    }

    this.scheduleSave();
  }

  /**
   * Get assignment history
   */
  getAssignmentHistory(
    appId?: string,
    objectType?: string,
    limit?: number
  ): PersistedConfig['assignments']['history'] {
    let history = [...this.config.assignments.history];

    if (appId) {
      history = history.filter(h => h.appId === appId);
    }

    if (objectType) {
      history = history.filter(h => h.objectType === objectType);
    }

    history.sort((a, b) => b.timestamp - a.timestamp);

    if (limit) {
      history = history.slice(0, limit);
    }

    return history;
  }

  /**
   * Save assignment pattern
   */
  saveAssignmentPattern(
    appId: string,
    objectType: string,
    pattern: {
      preferredRanges?: Array<{ from: number; to: number }>;
      namingPattern?: string;
      lastUsedId?: number;
    }
  ): void {
    if (!this.config.assignments.patterns[appId]) {
      this.config.assignments.patterns[appId] = {};
    }

    this.config.assignments.patterns[appId][objectType] = pattern;
    this.scheduleSave();
  }

  /**
   * Get assignment pattern
   */
  getAssignmentPattern(
    appId: string,
    objectType: string
  ): PersistedConfig['assignments']['patterns'][string][string] | undefined {
    return this.config.assignments.patterns[appId]?.[objectType];
  }

  /**
   * Save preferences
   */
  savePreferences(preferences: Partial<PersistedConfig['preferences']>): void {
    this.config.preferences = {
      ...this.config.preferences,
      ...preferences
    };
    this.scheduleSave();
  }

  /**
   * Get preferences
   */
  getPreferences(): PersistedConfig['preferences'] {
    return { ...this.config.preferences };
  }

  /**
   * Clear workspace data
   */
  clearWorkspace(workspacePath: string): void {
    delete this.config.workspaces[workspacePath];

    // Also clear related assignment patterns
    const workspace = this.config.workspaces[workspacePath];
    if (workspace) {
      for (const app of workspace.apps) {
        delete this.config.assignments.patterns[app.appId];
      }
    }

    this.scheduleSave();
  }

  /**
   * Clear all configuration
   */
  clearAll(): void {
    this.config = this.getDefaultConfig();
    this.saveConfig();
  }

  /**
   * Export configuration
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration
   */
  importConfig(configJson: string): boolean {
    try {
      const imported = JSON.parse(configJson) as PersistedConfig;

      // Validate structure
      if (!imported.version || !imported.workspaces) {
        throw new Error('Invalid configuration format');
      }

      // Migrate if needed
      if (this.needsMigration(imported)) {
        this.config = this.migrateConfig(imported);
      } else {
        this.config = imported;
      }

      this.saveConfig();
      this.logger.info('Configuration imported successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to import configuration', error);
      return false;
    }
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Force save immediately
   */
  forceSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }

    if (this.isDirty) {
      this.saveConfig();
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    workspaceCount: number;
    appCount: number;
    assignmentCount: number;
    patternCount: number;
    lastUpdated: number;
  } {
    let appCount = 0;
    for (const workspace of Object.values(this.config.workspaces)) {
      appCount += workspace.apps.length;
    }

    let patternCount = 0;
    for (const appPatterns of Object.values(this.config.assignments.patterns)) {
      patternCount += Object.keys(appPatterns).length;
    }

    return {
      workspaceCount: Object.keys(this.config.workspaces).length,
      appCount,
      assignmentCount: this.config.assignments.history.length,
      patternCount,
      lastUpdated: this.config.lastUpdated
    };
  }
}