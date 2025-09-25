export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

interface ErrorWithStatus {
  status?: number;
  code?: string;
}

export class RetryHandler {
  private maxRetries: number;
  private initialDelay: number;
  private maxDelay: number;
  private backoffMultiplier: number;

  constructor(options: RetryOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.initialDelay = options.initialDelay ?? 1000; // 1 second
    this.maxDelay = options.maxDelay ?? 30000; // 30 seconds
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
  }

  async execute<T>(
    operation: () => Promise<T>,
    retryable: (error: ErrorWithStatus) => boolean = (error) => {
      // Retry on network errors and 5xx status codes
      if (error.status === 0 || (error.status !== undefined && error.status >= 500 && error.status < 600)) {
        return true;
      }
      // Retry on rate limiting
      if (error.status === 429) {
        return true;
      }
      // Retry on specific error codes
      if (error.code && ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code)) {
        return true;
      }
      return false;
    }
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!retryable(error as ErrorWithStatus) || attempt === this.maxRetries) {
          throw error;
        }

        const delay = Math.min(
          this.initialDelay * Math.pow(this.backoffMultiplier, attempt),
          this.maxDelay
        );

        await this.delay(delay);
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}