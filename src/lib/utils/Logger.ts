import { LoggableData, isError } from '../types/LoggerTypes';

export enum LogLevel {
  Error = 0,
  Info = 1,
  Verbose = 2,
  Debug = 3
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.Info;
  private sensitiveKeys = [
    'authKey',
    'apiKey',
    'X-Functions-Key',
    'x-functions-key',
    'pollKey',
    'password',
    'token',
    'secret'
  ];

  private constructor() {
    // Private constructor for singleton pattern
  }

  static getInstance(): Logger {
    if (!this.instance) {
      this.instance = new Logger();
    }
    return this.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  error(message: string, error?: LoggableData): void {
    if (this.logLevel >= LogLevel.Error) {
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[ERROR] ${this.timestamp()} ${message} ${error ? JSON.stringify(this.sanitizeData(error)) : ''}\n`);
    }
  }

  info(message: string, data?: LoggableData): void {
    if (this.logLevel >= LogLevel.Info) {
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[INFO] ${this.timestamp()} ${message} ${data ? JSON.stringify(this.sanitizeData(data)) : ''}\n`);
    }
  }

  verbose(message: string, data?: LoggableData): void {
    if (this.logLevel >= LogLevel.Verbose) {
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[VERBOSE] ${this.timestamp()} ${message} ${data ? JSON.stringify(this.sanitizeData(data)) : ''}\n`);
    }
  }

  warn(message: string, data?: LoggableData): void {
    if (this.logLevel >= LogLevel.Info) {
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[WARN] ${this.timestamp()} ${message} ${data ? JSON.stringify(this.sanitizeData(data)) : ''}\n`);
    }
  }

  setLevel(level: LogLevel | string): void {
    if (typeof level === 'string') {
      const levelMap: Record<string, LogLevel> = {
        'error': LogLevel.Error,
        'info': LogLevel.Info,
        'verbose': LogLevel.Verbose,
        'debug': LogLevel.Debug
      };
      this.logLevel = levelMap[level.toLowerCase()] || LogLevel.Info;
    } else {
      this.logLevel = level;
    }
  }

  debug(message: string, data?: LoggableData): void {
    if (this.logLevel >= LogLevel.Debug) {
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[DEBUG] ${this.timestamp()} ${message} ${data ? JSON.stringify(this.sanitizeData(data)) : ''}\n`);
    }
  }

  request(method: string, url: string, data?: LoggableData): void {
    if (this.logLevel >= LogLevel.Verbose) {
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[REQUEST] ${this.timestamp()} ${method} ${url} ${data ? JSON.stringify(this.sanitizeData(data)) : ''}\n`);
    }
  }

  response(status: number, url: string, data?: LoggableData): void {
    if (this.logLevel >= LogLevel.Verbose) {
      const statusText = status >= 200 && status < 300 ? 'SUCCESS' : 'FAILURE';
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[RESPONSE] ${this.timestamp()} ${statusText} (${status}) ${url} ${data ? JSON.stringify(this.sanitizeData(data)) : ''}\n`);
    }
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  private sanitizeData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return data;
    }

    if (isError(data)) {
      // Create a clean error object without spreading the Error instance
      const errorObj: Record<string, unknown> = {
        message: data.message,
        stack: data.stack
      };
      // Copy enumerable properties from the error
      const errorAsAny = data as any; // Errors can have custom properties
      for (const key in errorAsAny) {
        if (Object.prototype.hasOwnProperty.call(errorAsAny, key) && key !== 'message' && key !== 'stack') {
          errorObj[key] = this.sanitizeData(errorAsAny[key]);
        }
      }
      return errorObj;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      const obj = data as Record<string, unknown>;
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const lowerKey = key.toLowerCase();
          const isSensitive = this.sensitiveKeys.some(sensitive =>
            lowerKey.includes(sensitive.toLowerCase())
          );

          if (isSensitive && obj[key]) {
            sanitized[key] = '***REDACTED***';
          } else {
            sanitized[key] = this.sanitizeData(obj[key]);
          }
        }
      }
      return sanitized;
    }

    return data;
  }
}