export class BackendError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BackendError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NetworkError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

interface ErrorLike {
  code?: string;
  status?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export class ErrorHandler {
  static handle(error: ErrorLike | Error): never {
    // Network errors
    if ('code' in error && error.code) {
      switch (error.code) {
        case 'ECONNREFUSED':
          throw new NetworkError('Connection refused. Backend service may be down.', error.code, error.details);
        case 'ENOTFOUND':
          throw new NetworkError('Backend service not found. Check your backend URL configuration.', error.code, error.details);
        case 'ETIMEDOUT':
          throw new NetworkError('Request timed out. The backend service is not responding.', error.code, error.details);
        case 'ECONNRESET':
          throw new NetworkError('Connection reset by backend service.', error.code, error.details);
        default:
          throw new NetworkError(`Network error: ${error.message || 'Unknown'}`, error.code, error.details);
      }
    }

    // HTTP status code errors
    if ('status' in error && error.status) {
      switch (error.status) {
        case 400:
          throw new BackendError(
            'Bad request. Check your request parameters.',
            400,
            error.details
          );
        case 401:
          throw new BackendError(
            'Unauthorized. Invalid API key. Please check your configuration.',
            401,
            error.details
          );
        case 403:
          throw new BackendError(
            'Forbidden. App not authorized or insufficient permissions.',
            403,
            error.details
          );
        case 404:
          throw new BackendError(
            'Not found. The requested resource or endpoint does not exist.',
            404,
            error.details
          );
        case 409:
          throw new BackendError(
            'Conflict. The operation conflicts with existing data.',
            409,
            error.details
          );
        case 429:
          throw new BackendError(
            'Rate limit exceeded. Too many requests. Please try again later.',
            429,
            error.details
          );
        case 500:
          throw new BackendError(
            'Internal server error. The backend service encountered an error.',
            500,
            error.details
          );
        case 502:
          throw new BackendError(
            'Bad gateway. The backend service is not responding correctly.',
            502,
            error.details
          );
        case 503:
          throw new BackendError(
            'Service unavailable. The backend service is temporarily unavailable.',
            503,
            error.details
          );
        case 504:
          throw new BackendError(
            'Gateway timeout. The backend service did not respond in time.',
            504,
            error.details
          );
        default:
          if (error.status >= 400 && error.status < 500) {
            throw new BackendError(
              `Client error (${error.status}): ${error.message || 'Unknown error'}`,
              error.status,
              error.details
            );
          } else if (error.status >= 500) {
            throw new BackendError(
              `Server error (${error.status}): ${error.message || 'Unknown error'}`,
              error.status,
              error.details
            );
          }
      }
    }

    // Default case
    throw error;
  }

  static isRetryable(error: unknown): boolean {
    // Network errors are usually retryable
    if (error instanceof NetworkError) {
      return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code || '');
    }

    // Check for raw error objects with network error codes
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as ErrorLike).code;
      return code ? ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(code) : false;
    }

    // Backend errors: retry on 5xx and specific 4xx codes
    if (error instanceof BackendError) {
      return error.statusCode >= 500 || error.statusCode === 429;
    }

    // Check raw error with status
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as ErrorLike).status;
      return status !== undefined ? (status >= 500 || status === 429 || status === 0) : false;
    }

    return false;
  }
}