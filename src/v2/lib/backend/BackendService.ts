/**
 * Backend Service for Azure Functions communication
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BackendError } from '../errors/hierarchy';
import {
  AuthorizationParams,
  AuthorizationResult,
  ConfigParams,
  ConfigResult,
  AllocateIdParams,
  AllocateIdResult,
  AnalyzeWorkspaceParams,
  AnalyzeWorkspaceResult
} from '../types/tools/lite';
import {
  PoolParams as BackendPoolParams,
  PoolResult,
  GetConsumptionParams,
  GetConsumptionResponse,
  SyncIdsParams,
  SyncIdsResult,
  GetLogsParams,
  GetLogsResult,
  GetNewsParams,
  GetNewsResult,
  AuthorizeAppRequest,
  GetNextRequest,
  StoreAssignmentResponse,
  ALObjectType
} from '../types/backend';

/**
 * Backend service for communicating with Azure Functions
 */
export class BackendService {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.BACKEND_URL || 'https://vjekocom-alext-weu.azurewebsites.net';
    this.apiKey = apiKey || process.env.BACKEND_API_KEY;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'x-api-key': this.apiKey })
      }
    });
  }

  /**
   * Handle authorization operations
   */
  async authorization(params: AuthorizationParams): Promise<AuthorizationResult> {
    try {
      const endpoint = this.getAuthorizationEndpoint(params.action);
      const method = this.getAuthorizationMethod(params.action);
      const payload = await this.prepareAuthorizationPayload(params);

      let response;
      if (method === 'GET') {
        // Azure Functions expects body even with GET request
        response = await this.client.get(endpoint, { data: payload });
      } else if (method === 'DELETE') {
        response = await this.client.delete(endpoint, { data: payload });
      } else {
        response = await this.client.post(endpoint, payload);
      }

      return this.parseAuthorizationResponse(params.action, response.data);
    } catch (error) {
      throw this.handleError(error, 'authorization', params.action);
    }
  }

  /**
   * Handle configuration operations
   */
  async config(params: ConfigParams): Promise<ConfigResult> {
    try {
      // Config operations are typically local file operations
      // This is a placeholder for potential future backend sync
      return {
        action: params.action,
        config: params.patch,
        exists: true,
        valid: true
      };
    } catch (error) {
      throw this.handleError(error, 'config', params.action);
    }
  }

  /**
   * Handle ID allocation operations
   */
  async allocateId(params: AllocateIdParams): Promise<AllocateIdResult> {
    try {
      const endpoint = this.getAllocationEndpoint(params.mode);
      const payload = await this.prepareAllocationPayload(params);
      const response = await this.client.post(endpoint, payload);
      return this.parseAllocationResponse(params.mode, response.data);
    } catch (error) {
      throw this.handleError(error, 'allocate_id', params.mode);
    }
  }

  /**
   * Analyze workspace consumption
   */
  async analyzeWorkspace(params: AnalyzeWorkspaceParams): Promise<AnalyzeWorkspaceResult> {
    try {
      const appId = await this.getAppId(params.appPath);
      const endpoint = '/api/v2/getConsumption';
      const response = await this.client.post(endpoint, {
        appId,
        authKey: '',  // Empty auth key for public access
        includeDetails: params.return_level === 'detailed'
      });
      return this.parseConsumptionResponse(response.data);
    } catch (error) {
      throw this.handleError(error, 'analyze_workspace');
    }
  }

  /**
   * Store an ID assignment for tracking
   */
  async storeAssignment(params: {
    appPath: string;
    authKey?: string;
    type: ALObjectType | string;
    id: number;
  }): Promise<StoreAssignmentResponse> {
    try {
      const appId = await this.getAppId(params.appPath);
      const endpoint = '/api/v2/storeAssignment';
      const response = await this.client.post(endpoint, {
        appId,
        authKey: params.authKey || '',
        type: params.type as ALObjectType,
        id: params.id
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'store_assignment');
    }
  }

  /**
   * Remove an ID assignment
   */
  async removeAssignment(params: {
    appPath: string;
    authKey?: string;
    type: ALObjectType | string;
    id: number;
  }): Promise<StoreAssignmentResponse> {
    try {
      const appId = await this.getAppId(params.appPath);
      const endpoint = '/api/v2/storeAssignment';
      const response = await this.client.delete(endpoint, {
        data: {
          appId,
          authKey: params.authKey || '',
          type: params.type as ALObjectType,
          id: params.id
        }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'remove_assignment');
    }
  }

  /**
   * Check if an app exists/is known by the backend
   */
  async checkApp(params: {
    appPath: string;
  }): Promise<boolean> {
    try {
      const appId = await this.getAppId(params.appPath);
      const endpoint = '/api/v2/checkApp';
      const response = await this.client.get(endpoint, {
        data: {
          appId
        }
      });
      
      // Backend returns string "true"/"false" or boolean
      const result = response.data;
      return result === 'true' || result === true;
    } catch (error) {
      // If app not found, return false instead of throwing
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return false;
      }
      throw this.handleError(error, 'check_app');
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get the hashed app ID from app.json
   */
  /**
   * Handle pool operations
   */
  async pool(params: BackendPoolParams): Promise<PoolResult> {
    try {
      const appId = await this.getAppId(params.appId || params.appPath || '');
      let endpoint = '/api/v2/';
      let payload: Record<string, unknown> = {};

      switch (params.action) {
        case 'create':
          endpoint += 'createPool';
          // createPool doesn't need appId/authKey - it creates a new pool
          payload = {
            name: params.poolName,
            managementSecret: params.managementSecret || 'default-secret',
            joinKey: params.joinKey || 'default-join-key',
            apps: params.apps || [],
            allowAnyAppToManage: params.allowAnyAppToManage !== false
          };
          break;
        case 'join':
          endpoint += 'joinPool';  // Actually it's joinPool not joinAppToPool
          payload = {
            appId,
            authKey: params.authKey || '',
            poolId: params.poolId,
            joinKey: params.joinKey || '',
            apps: params.apps || [{ appId, name: 'Test App' }]
          };
          break;
        case 'leave':
          endpoint += 'leavePool';
          payload = {
            poolId: params.poolId || '',
            accessKey: (params as any).accessKey || '',
            apps: params.apps || []
          };
          break;
        case 'info':
          endpoint += 'getPoolInfo';
          payload = {
            poolId: params.poolId || '',
            accessKey: (params as any).accessKey || ''
          };
          break;
        case 'remove':
          endpoint += 'removePool';
          payload = {
            poolId: params.poolId || '',
            accessKey: (params as any).accessKey || '',
            deleteBlob: params.force || false
          };
          break;
        case 'rename':
          endpoint += 'renamePool';
          payload = {
            poolId: params.poolId || '',
            accessKey: (params as any).accessKey || '',
            name: params.newName || params.poolName || ''
          };
          break;
        default:
          throw new Error(`Unknown pool action: ${params.action}`);
      }

      const response = await this.client.post(endpoint, payload);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'pool', params.action);
    }
  }

  /**
   * Get detailed consumption data
   */
  async getConsumption(params: GetConsumptionParams): Promise<GetConsumptionResponse> {
    try {
      const appId = await this.getAppId(params.appPath);
      const endpoint = '/api/v2/getConsumption';

      // FIXED: Use GET method to match VS Code extension behavior
      // Azure Functions expects body even with GET request
      const response = await this.client.get(endpoint, {
        data: {
          appId,
          authKey: params.authKey || '',
          _sourceAppId: params.sourceAppId || appId  // For pool operations
        }
      });

      return response.data || {};
    } catch (error) {
      // If app not found (404), return empty consumption
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return {};
      }
      throw this.handleError(error, 'consumption');
    }
  }

  /**
   * Sync IDs with backend
   */
  async syncIds(params: SyncIdsParams): Promise<SyncIdsResult> {
    try {
      const appId = await this.getAppId(params.appPath);
      const endpoint = '/api/v2/autoSyncIds';

      // autoSyncIds expects appFolders array
      const response = await this.client.post(endpoint, {
        appFolders: [{
          appId,
          ids: params.ids || {}
        }]
      });

      // Extract response for this app
      const appResponse = response.data?.[appId] || {};
      return { success: true, ...appResponse };
    } catch (error) {
      throw this.handleError(error, 'sync');
    }
  }

  /**
   * Get activity logs
   */
  async getLogs(_params: GetLogsParams): Promise<GetLogsResult> {
    // Note: getLog doesn't exist in v2, return empty logs
    // In production, this might fall back to v1 or use a different endpoint
    return {
      logs: []
    };
  }

  /**
   * Get news from RSS feed
   */
  async getNews(_params: GetNewsParams): Promise<GetNewsResult> {
    // Note: news endpoint doesn't exist in v2, return empty news
    // In production, this would fetch from an RSS feed or different service
    return {
      news: []
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async getAppId(appPath: string | undefined): Promise<string> {
    if (!appPath) {
      throw new Error('App path is required');
    }
    const appJsonPath = path.join(appPath, 'app.json');

    try {
      const appJsonContent = await fs.readFile(appJsonPath, 'utf-8');
      const appJson = JSON.parse(appJsonContent);

      if (!appJson.id) {
        throw new Error('No app ID found in app.json');
      }

      // Hash the app ID using SHA256 (as per VS Code extension)
      return createHash('sha256').update(appJson.id).digest('hex');
    } catch {
      // Fallback to hashing the app path if we can't read app.json
      return createHash('sha256').update(appPath).digest('hex');
    }
  }

  private getAuthorizationEndpoint(action: string): string {
    switch (action) {
      case 'start':
        return '/api/v2/authorizeApp';
      case 'status':
        return '/api/v2/checkApp';
      case 'deauthorize':
        return '/api/v2/authorizeApp'; // Use same endpoint with DELETE method
      default:
        throw new BackendError(`Unknown authorization action: ${action}`);
    }
  }

  /**
   * Get the HTTP method for authorization endpoint
   */
  private getAuthorizationMethod(action: string): string {
    switch (action) {
      case 'start':
        return 'POST'; // authorizeApp accepts GET, POST, DELETE but we use POST for start
      case 'status':
        return 'GET'; // checkApp only accepts GET
      case 'deauthorize':
        return 'DELETE'; // authorizeApp with DELETE method for deauthorization
      default:
        return 'POST';
    }
  }

  private getAllocationEndpoint(mode: string): string {
    switch (mode) {
      case 'preview':
      case 'reserve':
        return '/api/v2/getNext';
      case 'reclaim':
        return '/api/v2/returnIds';
      default:
        throw new BackendError(`Unknown allocation mode: ${mode}`);
    }
  }

  private async prepareAuthorizationPayload(params: AuthorizationParams): Promise<Partial<AuthorizeAppRequest>> {
    const appId = await this.getAppId(params.appPath);

    const basePayload = {
      appId,
      gitUser: process.env.GIT_USER || 'unknown',
      gitEmail: process.env.GIT_EMAIL || 'unknown@example.com'
    };

    switch (params.action) {
      case 'start':
        return {
          ...basePayload,
          gitRepo: process.env.GIT_REPO || params.appPath
        };
      case 'status':
      case 'deauthorize':
        return { appId };
      default:
        return basePayload;
    }
  }

  private async prepareAllocationPayload(params: AllocateIdParams): Promise<Partial<GetNextRequest>> {
    const appId = await this.getAppId(params.appPath);

    // CRITICAL FIX: Use ranges from params instead of empty array
    // The backend needs ranges to properly track and reserve IDs
    const ranges = params.ranges || [];

    const basePayload = {
      appId,
      authKey: params.authKey,  // Include authKey for proper app tracking
      type: params.object_type as ALObjectType,
      count: params.count || 1,
      ranges: ranges
    };

    switch (params.mode) {
      case 'preview':
        return basePayload;
      case 'reserve':
        return basePayload;  // Ranges are critical for reserve mode
      case 'reclaim':
        return {
          appId,
          authKey: params.authKey,
          type: params.object_type as ALObjectType,
          ranges: ranges
        };
      default:
        return basePayload;
    }
  }

  private parseAuthorizationResponse(action: string, data: unknown): AuthorizationResult {
    const typedAction = action as AuthorizationResult['action'];
    const responseData = data as any; // Backend response format varies

    switch (action) {
      case 'status':
        // Backend returns string "true" or "false" or boolean
        return {
          action: typedAction,
          authorized: responseData === 'true' || responseData === true,
          app_info: responseData?.appInfo as AuthorizationResult['app_info']
        };
      case 'start':
        return {
          action: typedAction,
          authorized: true,
          authorization_key: responseData.authKey as string,
          app_info: responseData.appInfo as AuthorizationResult['app_info'],
          expires_at: responseData.expiresAt as string
        };
      case 'deauthorize':
        return {
          action: typedAction,
          authorized: false
        };
      default:
        return {
          action: typedAction,
          authorized: false
        };
    }
  }

  private parseAllocationResponse(mode: string, data: unknown): AllocateIdResult {
    const responseData = data as any; // Backend response format varies
    const baseResponse = {
      mode: mode as AllocateIdResult['mode'],
      ids: Array.isArray(responseData) ? responseData as number[] : (responseData.ids as number[] || []),
      object_type: responseData.type as string || 'unknown'
    };

    switch (mode) {
      case 'preview':
        return {
          ...baseResponse,
          available_count: responseData.available || responseData.length || 0,
          pool_info: responseData.poolInfo
        };
      case 'reserve':
        return {
          ...baseResponse,
          reserved: true,
          metadata: responseData.metadata
        };
      case 'reclaim':
        return {
          ...baseResponse,
          reclaimed_count: responseData.reclaimed || 0,
          failed_ids: responseData.failed || []
        };
      default:
        return baseResponse;
    }
  }

  private parseConsumptionResponse(data: unknown): AnalyzeWorkspaceResult {
    const responseData = data as any; // Backend response format varies
    // Transform backend response to our format
    const summary: AnalyzeWorkspaceResult['summary'] = {
      total_objects: 0,
      by_type: {},
      collision_count: 0
    };

    if (responseData.consumption) {
      const consumption = responseData.consumption as Record<string, { count?: number; ids?: number[]; ranges?: Array<{ from: number; to: number }> }>;
      Object.entries(consumption).forEach(([type, info]) => {
        summary.by_type[type] = {
          count: info.count || 0,
          ids: info.ids || [],
          ranges: info.ranges || []
        };
        summary.total_objects += info.count || 0;
      });
    }

    return {
      summary,
      objects: responseData.objects,
      collisions: responseData.collisions
    };
  }

  private handleError(error: unknown, tool: string, action?: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message = axiosError.response?.data || axiosError.message;

      if (status === 401 || status === 403) {
        throw new BackendError(`Authorization required for ${tool}`, { status, action });
      }
      if (status === 404) {
        throw new BackendError(`Resource not found: ${tool}`, { status, action });
      }
      if (status === 429) {
        throw new BackendError('Rate limit exceeded', { status, action });
      }
      if (status === 500 || status === 502 || status === 503) {
        throw new BackendError('Backend service unavailable', { status, action });
      }

      // Better error message for debugging
      const errorMsg = typeof message === 'object' ? JSON.stringify(message) : message;
      throw new BackendError(`Backend error: ${errorMsg}`, { status, action });
    }

    throw new BackendError(
      error instanceof Error ? error.message : 'Unknown backend error',
      { tool, action }
    );
  }
}