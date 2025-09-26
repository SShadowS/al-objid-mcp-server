/**
 * Re-export error codes from the main errors module
 * This file is a compatibility layer for STANDARD mode tools
 */

export { ErrorCode } from '../types/common/errors';

// Additional error codes specific to STANDARD mode tools
export enum StandardErrorCode {
  // Sync errors
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  SYNC_FAILED = 'SYNC_FAILED',

  // Pool errors
  POOL_NOT_FOUND = 'POOL_NOT_FOUND',
  POOL_ALREADY_EXISTS = 'POOL_ALREADY_EXISTS',
  POOL_FULL = 'POOL_FULL',

  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',

  // Additional mapping for compatibility
  INVALID_PARAMS = 'INVALID_PARAMETER',
}