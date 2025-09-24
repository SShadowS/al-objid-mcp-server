/**
 * Type definitions for Backend service types
 */

/**
 * Generic HTTP request data
 */
export interface HttpRequestData {
  [key: string]: unknown;
}

/**
 * Generic HTTP response data
 */
export interface HttpResponseData {
  [key: string]: unknown;
}

/**
 * Response from pool creation endpoint
 */
export interface PoolCreationResponse {
  poolId: string;
  accessKey: string;
  validationKey: string;
  managementKey: string;
  leaveKeys: Record<string, string>;
}

/**
 * Response from auto sync endpoint
 */
export interface AutoSyncResponse {
  success: boolean;
  apps?: Array<{
    appId: string;
    synced: boolean;
    error?: string;
  }>;
}

/**
 * Pool information response
 */
export interface PoolInfoResponse {
  poolId: string;
  name?: string;
  apps?: Array<{
    appId: string;
    name: string;
    joinedAt: number;
  }>;
}

/**
 * Pool join response
 */
export interface PoolJoinResponse {
  success: boolean;
  poolId: string;
  leaveKey?: string;
}

/**
 * Update check response
 */
export interface UpdateCheckResponse {
  hasUpdates: boolean;
  changes?: Array<{
    appId: string;
    type: 'consumption' | 'authorization' | 'pool';
    timestamp: number;
  }>;
}

/**
 * Store assignment response
 */
export interface StoreAssignmentResponse {
  updated?: boolean;
  error?: string;
}

/**
 * Authorization data from backend
 */
export interface BackendAuthorizationData {
  authorized: boolean;
  user?: {
    name: string;
    email: string;
  };
  valid?: boolean;
}

/**
 * Error response from backend
 */
export interface BackendErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}