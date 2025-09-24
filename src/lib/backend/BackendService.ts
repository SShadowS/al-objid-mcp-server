import { HttpClient, HttpRequest } from './HttpClient';
import { RetryHandler } from './RetryHandler';
import { ErrorHandler } from './ErrorHandler';
import { ConfigManager, Config } from '../config/ConfigManager';
import { Logger, LogLevel } from '../utils/Logger';
import { NextObjectIdInfo } from '../types/NextObjectIdInfo';
import { AuthorizationInfo } from '../types/AuthorizationInfo';
import { ConsumptionInfo } from '../types/ConsumptionInfo';
import { ALRanges } from '../types/ALRange';
import { LoggableData, PoolCreationResponse, PoolJoinResponse, AutoSyncResponse, UpdateCheckResponse } from '../types';

export interface CheckAppResponse {
  managed: boolean;
  hasPool?: boolean;
  poolId?: string;
}

export interface GetNextRequest {
  appId: string;
  type: string;
  ranges: ALRanges;
  authKey: string;
  perRange?: boolean;
  require?: number;
  user?: string;
}

export interface AuthorizeAppRequest {
  appId: string;
  appName: string;
  gitUser: string;
  gitEmail: string;
  gitRepo: string;
  gitBranch: string;
}

export interface SyncIdsRequest {
  appId: string;
  authKey: string;
  ids: ConsumptionInfo;
  merge?: boolean;
}

export interface GetConsumptionRequest {
  appId: string;
  authKey: string;
}

export interface CheckUpdateRequest {
  appId: string;
  lastCheck: number;
}

export class BackendService {
  private httpClient: HttpClient;
  private retryHandler: RetryHandler;
  private config: Config;
  private logger: Logger;

  constructor() {
    this.httpClient = new HttpClient();
    this.retryHandler = new RetryHandler({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000
    });
    this.config = ConfigManager.getInstance().loadConfig();
    this.logger = Logger.getInstance();

    // Set log level based on config
    if (this.config.defaults.verboseLogging) {
      this.logger.setLogLevel(LogLevel.Verbose);
    }
  }

  private async sendRequest<T>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    data?: LoggableData,
    usePollBackend = false
  ): Promise<T> {
    const backend = usePollBackend
      ? {
          url: this.config.backend.pollUrl,
          key: this.config.backend.pollKey
        }
      : {
          url: this.config.backend.url,
          key: this.config.backend.apiKey
        };

    if (!backend.url) {
      throw new Error(`Backend URL not configured for ${usePollBackend ? 'polling' : 'main'} service`);
    }

    // Parse URL to extract hostname and protocol
    let hostname = backend.url;
    let protocol = 'https:';
    
    // Remove protocol if present
    if (backend.url.startsWith('https://')) {
      hostname = backend.url.substring(8);
    } else if (backend.url.startsWith('http://')) {
      hostname = backend.url.substring(7);
      protocol = 'http:';
    }

    const request: HttpRequest = {
      hostname,
      path,
      method,
      headers: backend.key ? {
        'X-Functions-Key': backend.key
      } : undefined,
      data: data as Record<string, unknown> | undefined
    };

    const fullUrl = `${protocol}//${hostname}${path}`;
    this.logger.request(method, fullUrl, data);

    try {
      const response = await this.retryHandler.execute(
        async () => {
          const result = await this.httpClient.send<T>(request);

          if (result.error) {
            this.logger.response(result.status, fullUrl, result.error);
            throw {
              status: result.status,
              message: result.error.message || 'Request failed',
              details: result.error
            };
          }

          this.logger.response(result.status, fullUrl, result.value);

          if (result.status >= 400) {
            throw {
              status: result.status,
              message: `HTTP ${result.status} error`,
              details: result.value
            };
          }

          return result;
        },
        (error) => ErrorHandler.isRetryable(error)
      );

      return response.value as T;
    } catch (error) {
      this.logger.error(`Request failed: ${method} ${fullUrl}`, error);
      ErrorHandler.handle(error as Error);
    }
  }

  /**
   * Check if an app is known and managed by the backend
   */
  async checkApp(appId: string): Promise<CheckAppResponse> {
    try {
      // The v2/checkApp endpoint uses GET method with appId in the body and returns a simple string "true" or "false"
      const response = await this.sendRequest<string>(
        `/api/v2/checkApp`,
        'GET',
        { appId }
      );

      // Parse the string response into our expected format
      const isManaged = response === 'true';

      // TODO: Get pool information from a different endpoint if needed
      // For now, we just return the basic managed status
      return {
        managed: isManaged,
        hasPool: false,
        poolId: undefined
      };
    } catch (error) {
      this.logger.error(`Failed to check app ${appId}`, error);
      return { managed: false };
    }
  }

  /**
   * Get next available object ID(s) from the backend
   *
   * This method retrieves the next available ID(s) for a given object type.
   * Can operate in preview mode (GET) or commit mode (POST).
   *
   * @param request - The request containing appId, type, ranges, and optional requirements
   * @param commit - If true, commits the ID (POST). If false, just previews (GET)
   * @returns Information about the next available ID(s), or undefined on error
   *
   * @remarks
   * - GET method (commit=false) just returns the next available ID without reserving
   * - POST method (commit=true) reserves the ID and marks it as consumed
   * - When require is specified, attempts to reserve that specific ID
   * - perRange flag affects how IDs are distributed across ranges
   *
   * @example
   * ```typescript
   * // Preview next available table ID
   * const info = await backend.getNext({
   *   appId: 'app123',
   *   authKey: 'key456',
   *   type: 'table',
   *   ranges: [{ from: 50000, to: 50099 }]
   * }, false);
   * ```
   *
   * @example
   * ```typescript
   * // Reserve specific ID 50005
   * const info = await backend.getNext({
   *   appId: 'app123',
   *   authKey: 'key456',
   *   type: 'table',
   *   ranges: [{ from: 50000, to: 50099 }],
   *   require: 50005
   * }, true);
   * ```
   *
   * @example
   * ```typescript
   * // Get and commit next codeunit ID
   * const info = await backend.getNext({
   *   appId: 'app123',
   *   authKey: 'key456',
   *   type: 'codeunit',
   *   ranges: [{ from: 50000, to: 50099 }]
   * }, true);
   * ```
   */
  async getNext(
    request: GetNextRequest,
    commit = false
  ): Promise<NextObjectIdInfo | undefined> {
    const method = commit ? 'POST' : 'GET';

    // Apply range limiting logic when committing with perRange and require
    let ranges = request.ranges;
    if (commit && request.perRange && request.require) {
      ranges = this.limitRanges(request.ranges, request.require);
    }

    try {
      const response = await this.sendRequest<NextObjectIdInfo>(
        '/api/v2/getNext',
        method,
        { ...request, ranges }
      );
      return response;
    } catch (error) {
      this.logger.error(`Failed to get next ID for app ${request.appId}`, error);
      return undefined;
    }
  }

  /**
   * Limit ranges to only the range containing the required ID
   * (matches Azure backend limitRanges function)
   */
  private limitRanges(ranges: ALRanges, require: number): ALRanges {
    for (const range of ranges) {
      if (require >= range.from && require <= range.to) {
        return [range];
      }
    }
    return [];
  }

  /**
   * Authorize an app for ID management (POST)
   */
  async authorizeApp(request: AuthorizeAppRequest): Promise<AuthorizationInfo> {
    try {
      // The backend returns only { authKey } on successful authorization
      const response = await this.sendRequest<{ authKey?: string }>(
        '/api/v2/authorizeApp',
        'POST',
        request
      );

      // Add the authorized flag since our interface expects it
      return {
        authKey: response.authKey || '',
        authorized: !!response.authKey,
        error: response.authKey ? undefined : 'Authorization failed'
      };
    } catch (error) {
      this.logger.error(`Failed to authorize app ${request.appId}`, error);
      throw error;
    }
  }

  /**
   * Get authorization info for an app (GET)
   */
  async getAuthInfo(appId: string, authKey: string): Promise<AuthorizationInfo | undefined> {
    try {
      const response = await this.sendRequest<{
        authorized: boolean;
        user?: { name: string; email: string };
        valid?: boolean;
      }>(
        '/api/v2/authorizeApp',
        'GET',
        { appId, authKey }
      );

      return {
        authKey,
        authorized: response.authorized,
        user: response.user,
        valid: response.valid
      };
    } catch (error) {
      this.logger.error(`Failed to get auth info for app ${appId}`, error);
      return undefined;
    }
  }

  /**
   * Deauthorize an app (DELETE)
   */
  async deauthorizeApp(appId: string, authKey: string): Promise<boolean> {
    try {
      const response = await this.sendRequest<{ deleted?: boolean }>(
        '/api/v2/authorizeApp',
        'DELETE',
        { appId, authKey }
      );

      return !!response.deleted;
    } catch (error) {
      this.logger.error(`Failed to deauthorize app ${appId}`, error);
      return false;
    }
  }

  /**
   * Synchronize consumed object IDs with the backend
   *
   * This method syncs the complete consumption state with the backend. Can operate in
   * merge mode (default) to add to existing consumption, or replace mode to completely
   * overwrite existing data.
   *
   * @param request - The sync request containing appId, authKey, ids, and merge flag
   * @returns True if synchronization was successful, false otherwise
   *
   * @remarks
   * - PATCH method is used for merge mode (adds to existing consumption)
   * - POST method is used for replace mode (overwrites all consumption)
   * - Default behavior is merge mode to prevent accidental data loss
   * - For individual ID assignments, use storeAssignment instead
   *
   * @example
   * ```typescript
   * // Merge new IDs with existing consumption
   * const success = await backend.syncIds({
   *   appId: 'app123',
   *   authKey: 'key456',
   *   ids: { table: [50000, 50001], page: [50000] },
   *   merge: true  // Default, adds to existing
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Replace all consumption (use with caution!)
   * const success = await backend.syncIds({
   *   appId: 'app123',
   *   authKey: 'key456',
   *   ids: { table: [50000, 50001] },
   *   merge: false  // Replaces all existing consumption
   * });
   * ```
   *
   * @warning
   * Using merge: false will completely replace all existing consumption data.
   * This can lead to data loss if not used carefully.
   */
  async syncIds(request: SyncIdsRequest): Promise<boolean> {
    try {
      // Use PATCH for merge mode (UPDATE), POST for replace mode - matches VSCode extension
      const method = request.merge ? 'PATCH' : 'POST';
      
      await this.sendRequest<void>(
        '/api/v2/syncIds',
        method,
        request
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to sync IDs for app ${request.appId}`, error);
      return false;
    }
  }

  /**
   * Auto-sync IDs for multiple apps in batch
   */
  async autoSyncIds(
    appFolders: Array<{
      appId: string;
      authKey?: string;
      ids: ConsumptionInfo;
    }>,
    patch = false
  ): Promise<AutoSyncResponse> {
    try {
      const response = await this.sendRequest<AutoSyncResponse>(
        '/api/v2/autoSyncIds',
        patch ? 'PATCH' : 'POST',
        { appFolders }
      );

      return response;
    } catch (error) {
      this.logger.error('Failed to auto-sync IDs', error);
      return { success: false };
    }
  }

  /**
   * Stores or removes an individual ID assignment in the backend
   *
   * This method is used for real-time tracking of individual ID assignments without
   * overwriting existing consumption data. It's particularly important for field and
   * enum IDs to avoid data loss.
   *
   * @param appId - The application ID (SHA256 hash of app.json id field)
   * @param authKey - The authorization key for the app
   * @param type - The object type (e.g., 'table', 'codeunit', 'table_50000' for fields)
   * @param id - The ID being assigned or removed
   * @param method - 'POST' to add assignment, 'DELETE' to remove assignment
   * @returns True if the assignment was successfully stored/removed, false otherwise
   *
   * @remarks
   * For field IDs, the type should be 'table_${tableId}'
   * For enum value IDs, the type should be 'enum_${enumId}'
   * This method updates consumption incrementally without replacing existing data
   *
   * @example
   * ```typescript
   * // Store a field ID assignment for table 50000
   * const success = await backend.storeAssignment(
   *   appId,
   *   authKey,
   *   'table_50000',
   *   15,
   *   'POST'
   * );
   * ```
   *
   * @example
   * ```typescript
   * // Store an enum value assignment for enum 50200
   * const success = await backend.storeAssignment(
   *   appId,
   *   authKey,
   *   'enum_50200',
   *   3,
   *   'POST'
   * );
   * ```
   */
  async storeAssignment(
    appId: string,
    authKey: string,
    type: string,
    id: number,
    method: 'POST' | 'DELETE'
  ): Promise<boolean> {
    try {
      const response = await this.sendRequest<{ updated?: boolean }>(
        '/api/v2/storeAssignment',
        method,
        { appId, authKey, type, id }
      );

      return !!response.updated;
    } catch (error) {
      this.logger.error(`Failed to ${method === 'POST' ? 'add' : 'remove'} assignment for app ${appId}`, error);
      return false;
    }
  }

  /**
   * Get consumption data for an app
   */
  async getConsumption(request: GetConsumptionRequest): Promise<ConsumptionInfo | undefined> {
    try {
      // Send as GET with body (matches VSCode extension behavior)
      const response = await this.sendRequest<ConsumptionInfo>(
        '/api/v2/getConsumption',
        'GET',
        request
      );

      // Add _total field to match Azure backend behavior
      if (response) {
        let total = 0;
        for (const key of Object.keys(response)) {
          if (Array.isArray(response[key])) {
            total += response[key].length;
          }
        }
        (response as ConsumptionInfo & { _total?: number })._total = total;
      }

      return response;
    } catch (error) {
      this.logger.error(`Failed to get consumption for app ${request.appId}`, error);
      return undefined;
    }
  }


  /**
   * Check for updates (polling endpoint)
   */
  async checkUpdate(request: CheckUpdateRequest): Promise<UpdateCheckResponse | undefined> {
    try {
      const response = await this.sendRequest<UpdateCheckResponse>(
        `/api/v2/check?appId=${encodeURIComponent(request.appId)}&lastCheck=${request.lastCheck}`,
        'GET',
        undefined,
        true // Use polling backend
      );
      return response;
    } catch (error) {
      this.logger.error(`Failed to check updates for app ${request.appId}`, error);
      return undefined;
    }
  }

  /**
   * Check multiple apps for updates (polling endpoint)
   */
  async check(
    payload: Array<{
      appId: string;
      authKey?: string;
      authorization: unknown;
    }>
  ): Promise<unknown> {
    try {
      const response = await this.sendRequest<unknown>(
        '/api/v2/check',
        'GET',
        payload,
        true // Use polling backend
      );
      return response;
    } catch (error) {
      this.logger.error('Failed to check apps for updates', error);
      return null;
    }
  }

  /**
   * Create an app pool
   */
  async createPool(
    appId: string,
    authKey: string,
    name: string,
    joinKey: string,
    managementSecret: string,
    apps?: Array<{ appId: string; name: string }>,
    allowAnyAppToManage = false
  ): Promise<PoolCreationResponse | undefined> {
    try {
      const response = await this.sendRequest<{
        poolId: string;
        accessKey: string;
        validationKey: string;
        managementKey: string;
        leaveKeys: Record<string, string>;
      }>(
        '/api/v2/createPool',
        'POST',
        {
          name,
          joinKey,
          managementSecret,
          apps: apps || [{ appId, name }],
          allowAnyAppToManage
        }
      );
      return response;
    } catch (error) {
      this.logger.error(`Failed to create pool`, error);
      return undefined;
    }
  }

  /**
   * Join an app pool
   */
  async joinPool(
    poolId: string,
    joinKey: string,
    apps: Array<{ appId: string; name: string }>
  ): Promise<PoolJoinResponse | null> {
    try {
      const response = await this.sendRequest<PoolJoinResponse>(
        '/api/v2/joinPool',
        'POST',
        { poolId, joinKey, apps }
      );
      return response;
    } catch (error) {
      this.logger.error(`Failed to join pool ${poolId}`, error);
      return null;
    }
  }

  /**
   * Leave an app pool
   */
  async leavePool(appId: string, authKey: string): Promise<boolean> {
    try {
      await this.sendRequest<void>(
        '/api/v2/leavePool',
        'POST',
        { appId, authKey }
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to leave pool for app ${appId}`, error);
      return false;
    }
  }
}