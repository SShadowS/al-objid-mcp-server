/**
 * LITE Mode Tool Types
 */

import { ALObjectType, Range, ObjIdConfig, AppInfo } from '../common/base';

// ============================================================================
// Authorization Tool Types
// ============================================================================

export enum AuthorizationAction {
  STATUS = 'status',
  START = 'start',
  DEAUTHORIZE = 'deauthorize'
}

export interface AuthorizationParams {
  action: AuthorizationAction | 'status' | 'start' | 'deauthorize';
  appPath: string;
  interactive?: boolean;
}

export interface AuthorizationResult {
  action: AuthorizationAction | 'status' | 'start' | 'deauthorize';
  authorized: boolean;
  app_info?: AppInfo;
  authorization_key?: string;
  expires_at?: string;
  warnings?: string[];
}

// ============================================================================
// Config Tool Types
// ============================================================================

export enum ConfigAction {
  READ = 'read',
  WRITE = 'write',
  VALIDATE = 'validate'
}

export interface ConfigParams {
  action: ConfigAction | 'read' | 'write' | 'validate';
  appPath: string;
  keys?: string[];
  patch?: Partial<ObjIdConfig>;
  merge?: boolean;
  schema_version?: string;
}

export interface ConfigResult {
  action: ConfigAction | 'read' | 'write' | 'validate';
  config?: Partial<ObjIdConfig>;
  path?: string;
  exists?: boolean;
  valid?: boolean;
  validation?: Array<{
    path: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
}

// ============================================================================
// Allocate ID Tool Types
// ============================================================================

export enum AllocateMode {
  PREVIEW = 'preview',
  RESERVE = 'reserve',
  RECLAIM = 'reclaim'
}

export interface AllocateIdParams {
  mode: AllocateMode | 'preview' | 'reserve' | 'reclaim';
  appPath: string;
  object_type: ALObjectType | string;
  count?: number;
  pool_id?: string;
  preferred_range?: Range;
  object_metadata?: {
    name?: string;
    file?: string;
    tag?: string;
  };
  ids?: number[];
  dry_run?: boolean;
}

export interface AllocateIdResult {
  mode: AllocateMode | 'preview' | 'reserve' | 'reclaim';
  ids: number[];
  object_type: string;
  reserved?: boolean;
  available_count?: number;
  pool_info?: {
    pool_id: string;
    name: string;
    size: number;
  };
  metadata?: any;
  reclaimed_count?: number;
  failed_ids?: number[];
  dry_run?: boolean;
}

// ============================================================================
// Analyze Workspace Tool Types
// ============================================================================

export interface AnalyzeWorkspaceParams {
  appPath: string;
  include?: string[];
  exclude?: string[];
  object_types?: ALObjectType[] | string[];
  return_level?: 'summary' | 'detailed';
  detect_collisions?: boolean;
  map_to_pools?: boolean;
}

export interface ConsumptionInfo {
  [objectType: string]: {
    count: number;
    ids: number[];
    ranges: Range[];
  };
}

export interface Collision {
  type: string;
  id: number;
  objects: Array<{
    name: string;
    file: string;
  }>;
}

export interface AnalyzeWorkspaceResult {
  summary: {
    total_objects: number;
    by_type: ConsumptionInfo;
    collision_count: number;
    pool_count?: number;
  };
  objects?: Array<{
    type: string;
    id: number;
    name: string;
    file: string;
  }>;
  collisions?: Collision[];
  pool_mapping?: {
    [poolId: string]: {
      name?: string;
      objects: any[];
    };
  };
}