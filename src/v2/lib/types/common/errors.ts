/**
 * Error codes for MCP Server V2
 */
export enum ErrorCode {
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  INVALID_ACTION = 'INVALID_ACTION',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',

  // Tool errors
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',

  // Authorization errors
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  NOT_AUTHORIZED = 'NOT_AUTHORIZED',

  // Configuration errors
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_WRITE_ERROR = 'CONFIG_WRITE_ERROR',

  // ID management errors
  NO_RANGES_DEFINED = 'NO_RANGES_DEFINED',
  NO_IDS_AVAILABLE = 'NO_IDS_AVAILABLE',
  ID_ALREADY_RESERVED = 'ID_ALREADY_RESERVED',
  ID_OUT_OF_RANGE = 'ID_OUT_OF_RANGE',

  // Backend errors
  BACKEND_ERROR = 'BACKEND_ERROR',
  BACKEND_TIMEOUT = 'BACKEND_TIMEOUT',
  BACKEND_UNAVAILABLE = 'BACKEND_UNAVAILABLE',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SCHEMA_VALIDATION_ERROR = 'SCHEMA_VALIDATION_ERROR',

  // Workspace errors
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  APP_NOT_FOUND = 'APP_NOT_FOUND',

  // Transaction errors
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  TRANSACTION_EXPIRED = 'TRANSACTION_EXPIRED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',

  // Policy errors
  POLICY_VIOLATION = 'POLICY_VIOLATION',

  // Concurrency errors
  PRECONDITION_FAILED = 'PRECONDITION_FAILED',
  CONFLICT = 'CONFLICT',

  // State errors
  INVALID_STATE = 'INVALID_STATE',
}

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Base error interface
 */
export interface MCPError {
  code: ErrorCode;
  message: string;
  severity?: ErrorSeverity;
  details?: any;
  tool?: string;
  action?: string;
}