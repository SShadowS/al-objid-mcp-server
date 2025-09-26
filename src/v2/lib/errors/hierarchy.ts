/**
 * Error hierarchy for MCP Server V2
 */

import { ErrorCode, ErrorSeverity, MCPError } from '../types/common/errors';

/**
 * Base error class for all MCP errors
 */
export abstract class BaseMCPError extends Error implements MCPError {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly details?: Record<string, any>;
  public readonly tool?: string;
  public readonly action?: string;

  constructor(
    code: ErrorCode,
    message: string,
    severity: ErrorSeverity = 'error',
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.details = details;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): MCPError {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      details: this.details,
      tool: this.tool,
      action: this.action,
    };
  }
}

/**
 * Validation error for parameter validation failures
 */
export class ValidationError extends BaseMCPError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCode.VALIDATION_ERROR, message, 'error', details);
  }
}

/**
 * Backend error for backend service failures
 */
export class BackendError extends BaseMCPError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCode.BACKEND_ERROR, message, 'error', details);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends BaseMCPError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCode.AUTHORIZATION_FAILED, message, 'error', details);
  }
}

/**
 * Configuration error
 */
export class ConfigError extends BaseMCPError {
  constructor(code: ErrorCode, message: string, details?: Record<string, any>) {
    super(code, message, 'error', details);
  }
}

/**
 * ID management error
 */
export class IdManagementError extends BaseMCPError {
  constructor(code: ErrorCode, message: string, details?: Record<string, any>) {
    super(code, message, 'error', details);
  }
}

/**
 * Transaction error
 */
export class TransactionError extends BaseMCPError {
  constructor(code: ErrorCode, message: string, details?: Record<string, any>) {
    super(code, message, 'error', details);
  }
}

/**
 * Policy error
 */
export class PolicyError extends BaseMCPError {
  constructor(message: string, violations?: Array<{ field: string; rule: string; value?: any }>) {
    super(ErrorCode.POLICY_VIOLATION, message, 'error', { violations });
  }
}

/**
 * Precondition error
 */
export class PreconditionError extends BaseMCPError {
  constructor(message: string, expected?: any, actual?: any) {
    super(ErrorCode.PRECONDITION_FAILED, message, 'error', { expected, actual });
  }
}