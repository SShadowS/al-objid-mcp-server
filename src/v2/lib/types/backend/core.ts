/**
 * Core backend types from Azure Functions
 * Matches azure-function-app/src/functions/v2/TypesV2.ts
 */

/**
 * AL Object Types enum (matches backend)
 */
export enum ALObjectType {
  codeunit = "codeunit",
  enum = "enum",
  enumextension = "enumextension",
  page = "page",
  pageextension = "pageextension",
  permissionset = "permissionset",
  permissionsetextension = "permissionsetextension",
  query = "query",
  report = "report",
  reportextension = "reportextension",
  table = "table",
  tableextension = "tableextension",
  xmlport = "xmlport"
}

/**
 * Authorization structure
 */
export interface Authorization {
  key: string;
  valid: boolean;
  user?: {
    name: string;
    email: string;
    timestamp: number;
  }
}

/**
 * Range definition
 */
export interface Range {
  from: number;
  to: number;
}

/**
 * Object consumption mapping
 */
export type ObjectConsumptions = {
  [key in ALObjectType]?: number[];
}

/**
 * Log entry structure
 */
export interface LogEntry {
  eventType: string;
  timestamp: number;
  user: string;
  data: Record<string, any>;
}

/**
 * Key pair for pool operations
 */
interface KeyPair {
  public: string;
  private: string;
}

/**
 * Pool app information
 */
export interface PoolAppInfo {
  appId: string;
  name: string;
}

/**
 * Complete app information stored in backend
 */
export type AppInfo = {
  _authorization?: Authorization;
  _ranges?: Range[];
  _log?: LogEntry[];
  _pool?: {
    joinLock: string;
    info: string;
    appIds: string[];
    validationKey: KeyPair;
    managementKey: KeyPair;
    leaveKeys: { [key: string]: string };
  };
} & ObjectConsumptions;

/**
 * Change operation types for logging
 */
export type ChangeOperation =
  | "getNext"
  | "syncMerge"
  | "syncFull"
  | "authorize"
  | "deauthorize"
  | "addAssignment"
  | "removeAssignment";