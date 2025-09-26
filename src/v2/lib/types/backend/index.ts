/**
 * Backend types for Azure Functions communication
 * Re-exports all backend types from their respective modules
 */

// Export core types
export {
  ALObjectType,
  Authorization,
  Range,
  ObjectConsumptions,
  LogEntry,
  PoolAppInfo,
  AppInfo,
  ChangeOperation
} from './core';

// Export request/response types
export {
  // Authorization
  AuthorizeAppRequest,
  AuthorizeAppResponse,
  // Get Next ID
  GetNextRequest,
  GetNextResponse,
  // Auto Sync
  AppConsumption,
  AutoSyncIdsRequest,
  AutoSyncIdsResponse,
  // Get Consumption
  GetConsumptionRequest,
  GetConsumptionResponse,
  // Store Assignment
  StoreAssignmentRequest,
  StoreAssignmentResponse,
  // Pool Operations
  CreatePoolRequest,
  CreatePoolResponse,
  JoinPoolRequest,
  JoinPoolResponse,
  GetPoolInfoRequest,
  GetPoolInfoResponse,
  RenamePoolRequest,
  RemovePoolRequest,
  LeavePoolRequest,
  LeavePoolAppInfo,
  RemoveFromPoolRequest
} from './requests';

// MCP Server-specific wrapper types
import { PoolAppInfo, ALObjectType, ObjectConsumptions, LogEntry } from './core';
import { GetPoolInfoResponse } from './requests';

/**
 * Pool operation parameters (MCP wrapper)
 */
export interface PoolParams {
  action: 'create' | 'join' | 'leave' | 'info' | 'remove' | 'rename';
  appId?: string;
  appPath?: string;
  poolId?: string;
  poolName?: string;
  description?: string;
  newName?: string;
  force?: boolean;
  authKey?: string;
  joinKey?: string;
  managementSecret?: string;
  apps?: PoolAppInfo[];
  allowAnyAppToManage?: boolean;
}

/**
 * Pool operation result (MCP wrapper)
 */
export interface PoolResult {
  success: boolean;
  message?: string;
  poolInfo?: GetPoolInfoResponse | null;
  poolId?: string;
  accessKey?: string;
  validationKey?: string;
  managementKey?: string;
  leaveKeys?: { [key: string]: string };
}

/**
 * Get consumption parameters (MCP wrapper)
 */
export interface GetConsumptionParams {
  appPath: string;
  appId?: string;
  authKey?: string;
  sourceAppId?: string;
  detailed?: boolean;
  objectType?: ALObjectType;
}

/**
 * Sync IDs parameters (MCP wrapper)
 */
export interface SyncIdsParams {
  appPath: string;
  appId?: string;
  authKey?: string;
  ids?: ObjectConsumptions;
  add?: Array<{ type: ALObjectType; id: number }>;
  remove?: Array<{ type: ALObjectType; id: number }>;
  clear?: boolean;
  sourceAppId?: string;
}

/**
 * Sync IDs result (MCP wrapper)
 */
export interface SyncIdsResult {
  success: boolean;
  added?: Array<{ type: ALObjectType; id: number }>;
  removed?: Array<{ type: ALObjectType; id: number }>;
  [key: string]: any;
}

/**
 * Get logs parameters (MCP wrapper)
 */
export interface GetLogsParams {
  appPath: string;
  appId?: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Get logs result (MCP wrapper)
 */
export interface GetLogsResult {
  logs: LogEntry[];
}

/**
 * News entry type
 */
export interface NewsEntry {
  id: string;
  type: string;
  message: string;
  buttons: Array<{
    caption: string;
    action: string;
    parameter?: any;
  }>;
}

/**
 * Get news parameters (MCP wrapper)
 */
export interface GetNewsParams {
  appPath: string;
  appId?: string;
  since?: string;
}

/**
 * Get news result (MCP wrapper)
 */
export interface GetNewsResult {
  news: NewsEntry[];
}