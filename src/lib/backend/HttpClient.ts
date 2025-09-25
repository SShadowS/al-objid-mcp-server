import * as https from 'https';
import * as http from 'http';

export interface HttpError {
  message: string;
  code?: string;
  syscall?: string;
  body?: string;
  parseError?: unknown;
  timeout?: number;
}

export interface HttpRequest {
  hostname: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: Record<string, unknown>; // Request body data for API calls
  timeout?: number;
}

export interface HttpResponse<T> {
  value?: T;
  error?: HttpError;
  status: number;
  headers?: http.IncomingHttpHeaders;
}

export class HttpClient {
  private defaultTimeout = 30000; // 30 seconds

  async send<T>(request: HttpRequest): Promise<HttpResponse<T>> {
    return new Promise((resolve) => {
      const isHttps = !request.hostname.startsWith('http://');
      const protocol = isHttps ? https : http;

      // Clean up hostname if it includes protocol
      const hostname = request.hostname
        .replace('https://', '')
        .replace('http://', '')
        .replace(/\/$/, '');

      const options: https.RequestOptions = {
        hostname,
        path: request.path,
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...request.headers
        },
        timeout: request.timeout || this.defaultTimeout
      };

      const req = protocol.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk.toString();
        });

        res.on('end', () => {
          try {
            // Handle empty responses
            if (!body || res.statusCode === 204) {
              resolve({
                value: undefined,
                status: res.statusCode || 0,
                headers: res.headers
              });
              return;
            }

            const value = JSON.parse(body);
            resolve({
              value,
              status: res.statusCode || 0,
              headers: res.headers
            });
          } catch (error) {
            resolve({
              error: {
                message: 'Invalid JSON response',
                body,
                parseError: error
              },
              status: res.statusCode || 0,
              headers: res.headers
            });
          }
        });
      });

      req.on('error', (error: NodeJS.ErrnoException) => {
        resolve({
          error: {
            message: error.message,
            code: error.code,
            syscall: error.syscall
          },
          status: 0
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          error: {
            message: 'Request timeout',
            timeout: request.timeout || this.defaultTimeout
          },
          status: 0
        });
      });

      // Write request body if present
      if (request.data) {
        const body = JSON.stringify(request.data);
        req.setHeader('Content-Length', Buffer.byteLength(body));
        req.write(body);
      }

      req.end();
    });
  }
}