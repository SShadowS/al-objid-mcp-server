/**
 * Backend API request/response types
 * Matches azure-function-app/src/functions/v2/{function}/types.ts
 */

import { ALObjectType, Range, ObjectConsumptions, PoolAppInfo } from './core';

// ============= Authorization =============
export interface AuthorizeAppRequest {
  appId: string;
  gitUser: string;
  gitEmail: string;
  gitRepo?: string;
  authKey?: string;
}

export interface AuthorizeAppResponse {
  authorized?: boolean;
  authKey?: string;
  deleted?: boolean;
  valid?: boolean;
  user?: {
    name: string;
    email: string;
    timestamp: number;
  }
}

// ============= Get Next ID =============
export interface GetNextRequest {
  appId: string;
  authKey?: string;
  type: ALObjectType;
  ranges: Range[];
  perRange?: boolean;
  require?: number;
}

export interface GetNextResponse {
  id: number | number[];
  updated: boolean;
  available: boolean;
  updateAttempts: number;
  hasConsumption: boolean;
}

// ============= Auto Sync IDs =============
export interface AppConsumption {
  appId: string;
  authKey?: string;
  ids: ObjectConsumptions;
}

export interface AutoSyncIdsRequest {
  appFolders: AppConsumption[];
}

export interface AutoSyncIdsResponse {
  [key: string]: ObjectConsumptions;
}

// ============= Get Consumption =============
export interface GetConsumptionRequest {
  appId: string;
  authKey?: string;
  _sourceAppId?: string;
}

export interface GetConsumptionResponse extends ObjectConsumptions {
  _appInfo?: any;
}

// ============= Store Assignment =============
export interface StoreAssignmentRequest {
  appId: string;
  authKey?: string;
  type: ALObjectType;
  id: number;
}

export interface StoreAssignmentResponse {
  updated: boolean;
}

// ============= Pool Operations =============
export interface CreatePoolRequest {
  name: string;
  managementSecret: string;
  joinKey: string;
  apps: PoolAppInfo[];
  allowAnyAppToManage: boolean;
}

export interface CreatePoolResponse {
  poolId: string;
  accessKey: string;
  validationKey: string;
  managementKey?: string;
  leaveKeys: { [key: string]: string };
}

export interface JoinPoolRequest {
  appId: string;
  authKey?: string;
  poolId: string;
  joinKey: string;
  apps: PoolAppInfo[];
}

export interface JoinPoolResponse {
  accessKey: string;
  validationKey: string;
  managementKey?: string;
  leaveKeys: { [key: string]: string };
}

export interface GetPoolInfoRequest {
  poolId: string;
  accessKey: string;
}

export interface GetPoolInfoResponse {
  name: string;
  apps: PoolAppInfo[];
}

export interface RenamePoolRequest {
  poolId: string;
  accessKey: string;
  name: string;
}

export interface RemovePoolRequest {
  poolId: string;
  accessKey: string;
  deleteBlob: boolean;
}

export interface LeavePoolAppInfo extends PoolAppInfo {
  leaveKey: string;
}

export interface LeavePoolRequest {
  poolId: string;
  accessKey: string;
  apps: LeavePoolAppInfo[];
}

export interface RemoveFromPoolRequest {
  poolId: string;
  accessKey: string;
  apps: PoolAppInfo[];
}