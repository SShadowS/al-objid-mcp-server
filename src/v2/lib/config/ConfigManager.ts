/**
 * Configuration Manager for MCP Server V2
 */

import fs from 'fs/promises';
import path from 'path';
import { ObjIdConfig } from '../types/common/base';
import { ConfigError } from '../errors/hierarchy';
import { ErrorCode } from '../errors/codes';

/**
 * Server configuration
 */
export interface ServerConfig {
  mode: 'lite' | 'standard';
  backendUrl: string;
  backendApiKey?: string;
  cacheEnabled: boolean;
  cacheTtl: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  gitUser?: string;
  gitEmail?: string;
  gitRepo?: string;
}

/**
 * Configuration manager for server and app settings
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private serverConfig: ServerConfig;
  private configCache: Map<string, { config: ObjIdConfig; timestamp: number }> = new Map();

  private constructor() {
    this.serverConfig = this.loadServerConfig();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Get server configuration
   */
  getServerConfig(): ServerConfig {
    return this.serverConfig;
  }

  /**
   * Load server configuration from environment
   */
  private loadServerConfig(): ServerConfig {
    return {
      mode: (process.env.MCP_MODE as 'lite' | 'standard') || 'lite',
      backendUrl: process.env.BACKEND_URL || 'https://vjekocom-alext-weu.azurewebsites.net',
      backendApiKey: process.env.BACKEND_API_KEY,
      cacheEnabled: process.env.CACHE_ENABLED !== 'false',
      cacheTtl: parseInt(process.env.CACHE_TTL || '300000'), // 5 minutes default
      logLevel: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
      gitUser: process.env.GIT_USER,
      gitEmail: process.env.GIT_EMAIL,
      gitRepo: process.env.GIT_REPO
    };
  }

  /**
   * Read .objidconfig file
   */
  async readObjIdConfig(appPath: string): Promise<ObjIdConfig | null> {
    try {
      // Check cache first
      const cached = this.configCache.get(appPath);
      if (cached && this.serverConfig.cacheEnabled) {
        const age = Date.now() - cached.timestamp;
        if (age < this.serverConfig.cacheTtl) {
          return cached.config;
        }
      }

      const configPath = path.join(appPath, '.objidconfig');
      const content = await fs.readFile(configPath, 'utf-8');

      // Parse JSONC (JSON with comments)
      const config = this.parseJsonc(content);

      // Validate structure
      this.validateObjIdConfig(config);

      // Update cache
      if (this.serverConfig.cacheEnabled) {
        this.configCache.set(appPath, { config: config as ObjIdConfig, timestamp: Date.now() });
      }

      return config as ObjIdConfig;
    } catch (error) {
      // Check if it's a file not found error
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return null;
      }
      throw new ConfigError(
        ErrorCode.CONFIG_INVALID,
        `Failed to read config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Write .objidconfig file
   */
  async writeObjIdConfig(appPath: string, config: ObjIdConfig, merge = true): Promise<void> {
    try {
      const configPath = path.join(appPath, '.objidconfig');

      let finalConfig = config;
      if (merge) {
        const existing = await this.readObjIdConfig(appPath);
        if (existing) {
          finalConfig = this.mergeConfigs(existing, config);
        }
      }

      // Validate before writing
      this.validateObjIdConfig(finalConfig);

      // Convert to formatted JSON
      const content = JSON.stringify(finalConfig, null, 2);
      await fs.writeFile(configPath, content, 'utf-8');

      // Update cache
      if (this.serverConfig.cacheEnabled) {
        this.configCache.set(appPath, { config: finalConfig, timestamp: Date.now() });
      }
    } catch (error) {
      throw new ConfigError(
        ErrorCode.CONFIG_WRITE_ERROR,
        `Failed to write config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate .objidconfig structure
   */
  validateObjIdConfig(config: any): void {
    if (!config || typeof config !== 'object') {
      throw new ConfigError(ErrorCode.CONFIG_INVALID, 'Config must be an object');
    }

    const objConfig = config as ObjIdConfig;
    // Validate required fields
    if (!objConfig.idRanges || typeof objConfig.idRanges !== 'object') {
      throw new ConfigError(ErrorCode.CONFIG_INVALID, 'idRanges is required');
    }

    // Validate ranges
    for (const [type, ranges] of Object.entries(objConfig.idRanges)) {
      if (!Array.isArray(ranges)) {
        throw new ConfigError(ErrorCode.CONFIG_INVALID, `Ranges for ${type} must be an array`);
      }

      for (const range of ranges) {
        if (!range.from || !range.to || typeof range.from !== 'number' || typeof range.to !== 'number') {
          throw new ConfigError(ErrorCode.CONFIG_INVALID, `Invalid range in ${type}`);
        }

        if (range.from > range.to) {
          throw new ConfigError(ErrorCode.CONFIG_INVALID, `Invalid range in ${type}: from > to`);
        }
      }
    }

    // Validate optional fields
    if (config.objectNamePrefix && typeof config.objectNamePrefix !== 'string') {
      throw new ConfigError(ErrorCode.CONFIG_INVALID, 'objectNamePrefix must be a string');
    }

    if (config.objectNameSuffix && typeof config.objectNameSuffix !== 'string') {
      throw new ConfigError(ErrorCode.CONFIG_INVALID, 'objectNameSuffix must be a string');
    }

    if (config.bcLicense && typeof config.bcLicense !== 'string') {
      throw new ConfigError(ErrorCode.CONFIG_INVALID, 'bcLicense must be a string');
    }
  }

  /**
   * Parse JSONC (JSON with comments)
   */
  private parseJsonc(content: string): any {
    // Remove single-line comments
    let cleaned = content.replace(/\/\/.*$/gm, '');

    // Remove multi-line comments
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove trailing commas
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      throw new ConfigError(
        ErrorCode.CONFIG_INVALID,
        `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Merge two configurations
   */
  private mergeConfigs(existing: ObjIdConfig, update: Partial<ObjIdConfig>): ObjIdConfig {
    const merged = { ...existing };

    // Merge idRanges
    if (update.idRanges) {
      merged.idRanges = { ...existing.idRanges, ...update.idRanges };
    }

    // Merge other fields
    if (update.objectNamePrefix !== undefined) {
      merged.objectNamePrefix = update.objectNamePrefix;
    }

    if (update.objectNameSuffix !== undefined) {
      merged.objectNameSuffix = update.objectNameSuffix;
    }

    if (update.bcLicense !== undefined) {
      merged.bcLicense = update.bcLicense;
    }

    if (update.appPoolId !== undefined) {
      merged.appPoolId = update.appPoolId;
    }

    return merged;
  }

  /**
   * Clear configuration cache
   */
  clearCache(appPath?: string): void {
    if (appPath) {
      this.configCache.delete(appPath);
    } else {
      this.configCache.clear();
    }
  }

  /**
   * Refresh the server config from environment variables
   * Used primarily in tests to update config after setting environment variables
   */
  refreshServerConfig(): void {
    this.serverConfig = this.loadServerConfig();
  }

  /**
   * Get app.json from app path
   */
  async readAppJson(appPath: string): Promise<Record<string, unknown>> {
    try {
      const appJsonPath = path.join(appPath, 'app.json');
      const content = await fs.readFile(appJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new ConfigError(
        ErrorCode.APP_NOT_FOUND,
        `Failed to read app.json: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Read configuration (alias for readObjIdConfig for compatibility)
   */
  async readConfig(appPath: string): Promise<ObjIdConfig> {
    const config = await this.readObjIdConfig(appPath);
    if (!config) {
      // Return default config if not found
      return {
        idRanges: {}
      };
    }
    return config;
  }

  /**
   * Write configuration (alias for writeObjIdConfig for compatibility)
   */
  async writeConfig(appPath: string, config: ObjIdConfig): Promise<void> {
    await this.writeObjIdConfig(appPath, config, true);
  }
}