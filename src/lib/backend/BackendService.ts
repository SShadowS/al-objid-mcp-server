import { HttpClient, HttpRequest } from './HttpClient';
import { RetryHandler } from './RetryHandler';
import { ErrorHandler } from './ErrorHandler';
import { ConfigManager, Config } from '../config/ConfigManager';
import { Logger, LogLevel } from '../utils/Logger';
import {
  GetNextRequest as BackendGetNextRequest,
  GetNextResponse,
  AuthorizeAppRequest as BackendAuthorizeAppRequest,
  AuthorizeAppResponse,
  ObjectConsumptionRequest,
  GetConsumptionResponse,
  CreatePoolRequest,
  CreatePoolResponse,
  JoinPoolRequest,
  JoinPoolResponse,
  LeavePoolRequest,
  LeavePoolResponse,
  StoreAssignmentRequest as BackendStoreAssignmentRequest,
  StoreAssignmentResponse,
  DefaultRequest,
  Range,
  ObjectConsumptions,
  AutoSyncResponse,
  UpdateCheckResponse,
  ALObjectType
} from '../types/BackendTypes';
import { ALRanges } from '../types/ALRange';
import { LoggableData } from '../types';

// MCP-specific response type for checkApp (backend returns plain string)
export interface CheckAppResponse {
  managed: boolean;
  hasPool?: boolean;
  poolId?: string;
}

// Extended request types that include DefaultRequest fields
export interface GetNextRequest extends BackendGetNextRequest, DefaultRequest {
  user?: string;  // Additional field for MCP
}

export interface AuthorizeAppRequest extends BackendAuthorizeAppRequest {
  appId: string;
  appName: string;
  gitRepo: string;
  gitBranch: string;
}

export interface SyncIdsRequest extends ObjectConsumptionRequest, DefaultRequest {
  mode?: 'merge' | 'replace';  // Default: 'merge' for MCP (safer for programmatic use)
  completeness?: 'partial' | 'full';  // Default: 'partial'
  scope?: string;  // Optional: file path or module for scoped sync
  tombstones?: ObjectConsumptions;  // Optional: IDs to remove in merge mode
  merge?: boolean;  // Deprecated: use mode instead (kept for backward compatibility)
}

export interface GetConsumptionRequest extends DefaultRequest {
  // Inherits appId and authKey from DefaultRequest
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
      // The v2/checkApp endpoint uses GET method with body and returns "true" or "false"
      // Note: The response can be either a string or boolean depending on how it's parsed
      const response = await this.sendRequest<string | boolean>(
        `/api/v2/checkApp`,
        'GET',
        { appId }
      );

      // Parse the response - handle both string and boolean responses
      const isManaged = response === 'true' || response === true;

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
   * Always uses POST method (v2 API uses POST for all endpoints).
   *
   * @param request - The request containing appId, type, ranges, and optional requirements
   * @param commit - Reserved for future use (v2 API always commits)
   * @returns Information about the next available ID(s), or undefined on error
   *
   * @remarks
   * - POST method reserves the ID and marks it as consumed
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
  ): Promise<GetNextResponse | undefined> {
    // v2 API uses GET for preview, POST for commit
    const method = commit ? 'POST' : 'GET';

    // Apply range limiting logic when perRange and require are specified
    let ranges = request.ranges;
    if (request.perRange && request.require) {
      ranges = this.limitRanges(request.ranges, request.require);
    }

    try {
      const response = await this.sendRequest<GetNextResponse>(
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
  async authorizeApp(request: AuthorizeAppRequest): Promise<AuthorizeAppResponse> {
    try {
      const response = await this.sendRequest<AuthorizeAppResponse>(
        '/api/v2/authorizeApp',
        'POST',
        request
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to authorize app ${request.appId}`, error);
      throw error;
    }
  }

  /**
   * Get authorization info for an app (GET)
   */
  async getAuthInfo(appId: string, authKey: string): Promise<AuthorizeAppResponse | undefined> {
    try {
      const response = await this.sendRequest<AuthorizeAppResponse>(
        '/api/v2/authorizeApp',
        'GET',
        { appId, authKey }
      );

      return response;
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
   * This method syncs consumption state with the backend. Defaults to merge mode (safer
   * for programmatic use) but can operate in replace mode when explicitly requested.
   *
   * @param request - The sync request containing appId, authKey, ids, and mode
   * @returns True if synchronization was successful, false otherwise
   *
   * @remarks
   * MCP Server behavior (differs from VS Code extension defaults):
   * - Default: 'merge' mode (PATCH) - adds to existing consumption
   * - Optional: 'replace' mode (POST) - overwrites all consumption
   * - Replace mode requires explicit completeness='full' for safety
   * - Supports scoped updates and tombstones for deletions in merge mode
   *
   * @example
   * ```typescript
   * // Default: Merge new IDs with existing consumption
   * const success = await backend.syncIds({
   *   appId: 'app123',
   *   authKey: 'key456',
   *   ids: { table: [50003, 50004] }
   *   // mode defaults to 'merge', completeness defaults to 'partial'
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Replace all consumption (requires explicit flags)
   * const success = await backend.syncIds({
   *   appId: 'app123',
   *   authKey: 'key456',
   *   ids: { table: [50000, 50001, 50002] },
   *   mode: 'replace',
   *   completeness: 'full'  // Required for replace mode
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Scoped update for a single file
   * const success = await backend.syncIds({
   *   appId: 'app123',
   *   authKey: 'key456',
   *   ids: { table: [50005] },
   *   scope: 'src/tables/Customer.al',
   *   tombstones: { table: [50000] }  // Remove old ID from this file
   * });
   * ```
   *
   * @warning
   * Replace mode will completely overwrite all existing consumption data.
   * It requires completeness='full' to prevent accidental data loss.
   */
  async syncIds(request: SyncIdsRequest): Promise<boolean> {
    try {
      // Determine mode: prioritize new 'mode' parameter, fall back to deprecated 'merge' boolean
      let mode: 'merge' | 'replace';
      if (request.mode) {
        mode = request.mode;
      } else if (request.merge !== undefined) {
        // Backward compatibility with old merge boolean
        this.logger.warn('Using deprecated "merge" parameter in syncIds. Please use "mode" instead.');
        mode = request.merge ? 'merge' : 'replace';
      } else {
        // Default to merge mode (safer for MCP programmatic use)
        mode = 'merge';
      }

      // Safeguard: Replace mode requires explicit completeness='full'
      if (mode === 'replace' && request.completeness !== 'full') {
        const idCount = Object.values(request.ids).reduce((sum, arr) => sum + (arr?.length || 0), 0);

        // Additional safeguard: warn if replace set seems too small
        if (idCount < 10) {
          this.logger.warn(
            `Replace mode with only ${idCount} IDs. This seems unusually small. ` +
            `Set completeness='full' to confirm this is intentional.`
          );
        }

        throw new Error(
          `Replace mode requires explicit completeness='full' to prevent accidental data loss. ` +
          `Current completeness: '${request.completeness || 'partial'}'. ` +
          `If you're sure you want to replace all consumption, set completeness='full'.`
        );
      }

      // Log the operation mode for debugging
      this.logger.info(
        `Syncing IDs for app ${request.appId} in ${mode} mode` +
        (request.scope ? ` (scope: ${request.scope})` : '') +
        (request.tombstones ? ' with tombstones' : '')
      );

      // Use PATCH for merge mode, POST for replace mode
      const method = mode === 'merge' ? 'PATCH' : 'POST';

      // Prepare the request payload
      const payload = {
        appId: request.appId,
        authKey: request.authKey,
        ids: request.ids,
        scope: request.scope,
        tombstones: request.tombstones
      };

      await this.sendRequest<void>(
        '/api/v2/syncIds',
        method,
        payload
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
      ids: ObjectConsumptions;
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
    type: ALObjectType | string,  // Accept string for field/enum types like "table_50000"
    id: number,
    method: 'POST' | 'DELETE'
  ): Promise<boolean> {
    try {
      const response = await this.sendRequest<StoreAssignmentResponse>(
        '/api/v2/storeAssignment',
        method,
        { appId, authKey, type: type as ALObjectType, id }
      );

      return !!response?.success;
    } catch (error) {
      this.logger.error(`Failed to ${method === 'POST' ? 'add' : 'remove'} assignment for app ${appId}`, error);
      return false;
    }
  }

  /**
   * Get consumption data for an app
   */
  async getConsumption(request: GetConsumptionRequest): Promise<GetConsumptionResponse | undefined> {
    try {
      // Send as GET with body (v2 API uses GET with body)
      const response = await this.sendRequest<GetConsumptionResponse>(
        '/api/v2/getConsumption',
        'GET',
        request
      );

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
    name?: string,
    apps?: Array<{ appId: string; name: string }>
  ): Promise<CreatePoolResponse | undefined> {
    try {
      const request: CreatePoolRequest & DefaultRequest = {
        appId,
        authKey,
        name,
        apps
      };

      const response = await this.sendRequest<CreatePoolResponse>(
        '/api/v2/createPool',
        'POST',
        request
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
    appId: string,
    authKey: string,
    poolId: string,
    joinKey: string
  ): Promise<JoinPoolResponse | null> {
    try {
      const request: JoinPoolRequest & DefaultRequest = {
        appId,
        authKey,
        poolId,
        joinKey
      };

      const response = await this.sendRequest<JoinPoolResponse>(
        '/api/v2/joinPool',
        'POST',
        request
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
      const request: LeavePoolRequest & DefaultRequest = {
        appId,
        authKey
      };

      const response = await this.sendRequest<LeavePoolResponse>(
        '/api/v2/leavePool',
        'POST',
        request
      );
      return response.success;
    } catch (error) {
      this.logger.error(`Failed to leave pool for app ${appId}`, error);
      return false;
    }
  }
}