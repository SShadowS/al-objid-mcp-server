/**
 * Backend API type definitions
 * These are the exact types from azure-function-app/src/functions/v2
 */

export { ALObjectType } from './ALObjectType';

// From TypesV2.ts
export interface Authorization {
  key: string;
  valid: boolean;
  user?: {
    name: string;
    email: string;
    timestamp: number;
  }
}

export interface Range {
  from: number;
  to: number;
}

export type ObjectConsumptions = {
  [key in ALObjectType]: number[];
}

export interface LogEntry {
  eventType: string;
  timestamp: number;
  user: string;
  data: any;
}

interface KeyPair {
  public: string;
  private: string;
}

export type AppInfo = {
  _authorization: Authorization;
  _ranges: Range[];
  _log: LogEntry[];
  _pool: {
    joinLock: string;
    info: string;
    appIds: string[];
    validationKey: KeyPair;
    managementKey: KeyPair;
    leaveKeys: { [key: string]: string };
  },
} & ObjectConsumptions;

export interface PoolAppInfo {
  appId: string;
  name: string;
}

export interface PoolInfo {
  name: string;
  apps: PoolAppInfo[];
}

// From authorizeApp/types.ts
export interface AuthorizeAppRequest {
  gitUser: string; // This is encrypted!
  gitEMail: string; // This is always sent encrypted!
}

export interface AuthorizeAppResponse {
  authorized?: boolean;
  authKey?: string;
  deleted?: boolean;
  valid?: boolean;
  user?: {
    name: string; // This is always encrypted
    email: string; // This is always encrypted
    timestamp: number;
  }
}

// From getNext/types.ts
export interface GetNextRequest {
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

export interface ConsumptionUpdateContext {
  id: number;
  available: boolean;
  updated: boolean;
  updateAttempts: number;
}

// From syncIds/types.ts
export interface ObjectConsumptionRequest {
  ids: ObjectConsumptions;
}

// From getConsumption/types.ts
export interface GetConsumptionResponse extends ObjectConsumptions {
  _total: number;
}

// From createPool/types.ts
export interface CreatePoolRequest {
  name?: string;
  apps?: PoolAppInfo[];
}

export interface CreatePoolResponse {
  poolId: string;
  accessKey: string;
  joinKey: string;
}

// From joinPool/types.ts
export interface JoinPoolRequest {
  poolId: string;
  joinKey: string;
}

export interface JoinPoolResponse {
  success: boolean;
}

// From leavePool/types.ts
export interface LeavePoolRequest {
  // No specific fields, uses standard auth
}

export interface LeavePoolResponse {
  success: boolean;
}

// From storeAssignment/types.ts
export interface StoreAssignmentRequest {
  type: ALObjectType;
  id: number;
}

export interface StoreAssignmentResponse {
  success: boolean;
}

// Common request structure (all requests include appId and authKey)
export interface DefaultRequest {
  appId: string;
  authKey: string;
}

// Legacy types for backward compatibility
export interface HttpRequestData {
  [key: string]: unknown;
}

export interface HttpResponseData {
  [key: string]: unknown;
}

export interface ConsumptionInfo {
  [objectType: string]: number[];
}

export interface AuthorizationInfo extends Authorization {}

export interface NextObjectIdInfo extends GetNextResponse {}

// Re-export as PoolCreationResponse for compatibility
export type PoolCreationResponse = CreatePoolResponse;
export type PoolJoinResponse = JoinPoolResponse;
export type PoolInfoResponse = PoolInfo;
export type AutoSyncResponse = {
  success: boolean;
  apps?: Array<{
    appId: string;
    synced: boolean;
    error?: string;
  }>;
};
export type UpdateCheckResponse = {
  updateAvailable: boolean;
  currentVersion?: string;
  latestVersion?: string;
  downloadUrl?: string;
  releaseNotes?: string;
};