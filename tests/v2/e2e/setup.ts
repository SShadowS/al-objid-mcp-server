/**
 * E2E Test Setup
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { MCPServer } from '../../../src/v2/server';
import { ConfigManager } from '../../../src/v2/lib/config/ConfigManager';

export interface TestContext {
  server?: MCPServer;
  testAppPath: string;
  backendUrl: string;
}

/**
 * Create a test AL app structure
 */
export async function createTestApp(basePath: string, appName: string): Promise<string> {
  const appPath = path.join(basePath, appName);

  // Create directory
  await fs.mkdir(appPath, { recursive: true });

  // Create app.json
  const appJson = {
    id: `test-app-${Date.now()}`,
    name: appName,
    version: '1.0.0.0',
    publisher: 'Test Publisher',
    brief: 'Test App',
    description: 'Test App for E2E testing',
    privacyStatement: '',
    EULA: '',
    help: '',
    url: '',
    logo: '',
    dependencies: [],
    screenshots: [],
    platform: '19.0.0.0',
    application: '19.0.0.0',
    idRanges: [
      { from: 50000, to: 50099 }
    ],
    runtime: '8.0'
  };

  await fs.writeFile(
    path.join(appPath, 'app.json'),
    JSON.stringify(appJson, null, 2)
  );

  // Create .objidconfig
  const objIdConfig = {
    objectRanges: {
      table: [{ from: 50000, to: 50019 }],
      page: [{ from: 50020, to: 50039 }],
      codeunit: [{ from: 50040, to: 50059 }],
      report: [{ from: 50060, to: 50079 }],
      xmlport: [{ from: 50080, to: 50099 }]
    },
    objectNamePrefix: 'TEST',
    bcLicense: ''
  };

  await fs.writeFile(
    path.join(appPath, '.objidconfig'),
    JSON.stringify(objIdConfig, null, 2)
  );

  // Create a sample AL file
  const alContent = `table 50000 "TEST Customer"
{
    DataClassification = CustomerContent;

    fields
    {
        field(1; "No."; Code[20])
        {
            DataClassification = CustomerContent;
        }
        field(2; Name; Text[100])
        {
            DataClassification = CustomerContent;
        }
    }

    keys
    {
        key(PK; "No.")
        {
            Clustered = true;
        }
    }
}`;

  await fs.writeFile(
    path.join(appPath, 'Customer.Table.al'),
    alContent
  );

  return appPath;
}

/**
 * Clean up test app
 */
export async function cleanupTestApp(appPath: string): Promise<void> {
  try {
    await fs.rm(appPath, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Failed to cleanup test app: ${error}`);
  }
}

/**
 * Wait for condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Check if Azure Functions are running
 */
export async function checkBackendAvailable(url: string): Promise<boolean> {
  try {
    // Try to check if the backend is running
    const response = await fetch(`${url}/api/v2/checkApp?appId=test-e2e&authKey=test`, {
      method: 'GET'
    });

    // If we get any response (even empty or false), the backend is available
    // 404 would throw an error, so if we reach here, backend is running
    return response.ok || response.status < 500;
  } catch (error) {
    return false;
  }
}

/**
 * Check if Azure storage is available for operations that need it
 */
export function hasAzureStorageAccess(): boolean {
  // Check if we have Azure storage credentials
  const hasCredentials = !!(
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    process.env.CI ||
    process.env.GITHUB_ACTIONS
  );

  if (!hasCredentials) {
    console.log('Note: Azure storage credentials not available, some operations will be skipped');
  }

  return hasCredentials;
}

/**
 * Setup test environment
 */
export async function setupTestEnvironment(): Promise<TestContext> {
  // Use localhost for tests unless explicitly set
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:7071';
  const testBasePath = path.join(process.cwd(), '.test-apps');

  // Create test directory
  await fs.mkdir(testBasePath, { recursive: true });

  // Create test app
  const testAppPath = await createTestApp(testBasePath, `test-app-${Date.now()}`);

  return {
    testAppPath,
    backendUrl
  };
}

/**
 * Teardown test environment
 */
export async function teardownTestEnvironment(context: TestContext): Promise<void> {
  // Clean up test app
  if (context.testAppPath) {
    await cleanupTestApp(context.testAppPath);
  }
}

/**
 * Set environment variables for tests
 */
export function setTestEnvironment(backendUrl: string): void {
  process.env.BACKEND_URL = backendUrl;
  process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
  process.env.MCP_MODE = 'lite';
  process.env.CACHE_ENABLED = 'false'; // Disable cache for predictable tests

  // Refresh ConfigManager to pick up the new environment variables
  const config = ConfigManager.getInstance();
  config.refreshServerConfig();
}

/**
 * Reset environment variables
 */
export function resetTestEnvironment(): void {
  delete process.env.BACKEND_URL;
  delete process.env.LOG_LEVEL;
  delete process.env.MCP_MODE;
  delete process.env.CACHE_ENABLED;
}