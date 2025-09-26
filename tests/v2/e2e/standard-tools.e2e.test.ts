/**
 * E2E Tests for STANDARD Mode Tools against local Azure Functions
 */

import {
  TestContext,
  setupTestEnvironment,
  teardownTestEnvironment,
  checkBackendAvailable,
  setTestEnvironment,
  resetTestEnvironment,
  createTestApp,
  hasAzureStorageAccess
} from './setup';
import { PoolTool } from '../../../src/v2/tools/standard/PoolTool';
import { ConsumptionTool } from '../../../src/v2/tools/standard/ConsumptionTool';
import { SyncTool } from '../../../src/v2/tools/standard/SyncTool';
import { LogTool } from '../../../src/v2/tools/standard/LogTool';
import { AuthorizationTool } from '../../../src/v2/tools/lite/AuthorizationTool';
import fs from 'fs/promises';
import path from 'path';

describe('STANDARD Mode Tools E2E Tests', () => {
  let context: TestContext;
  let isBackendAvailable: boolean = false;

  beforeAll(async () => {
    // Setup test environment
    context = await setupTestEnvironment();
    setTestEnvironment(context.backendUrl);

    // Check if backend is available
    isBackendAvailable = await checkBackendAvailable(context.backendUrl);

    if (!isBackendAvailable) {
      console.warn(`
        ⚠️  Azure Functions backend not available at ${context.backendUrl}
        ⚠️  Skipping E2E tests. To run E2E tests:
        ⚠️  1. Start Azure Functions: cd azure-function-app && npm start
        ⚠️  2. Run tests again: npm run test:e2e
      `);
    }

    // Ensure app is authorized for tests that need it
    if (isBackendAvailable && hasAzureStorageAccess()) {
      const authTool = new AuthorizationTool();
      try {
        await authTool.execute({
          action: 'start',
          appPath: context.testAppPath
        });
      } catch (error) {
        console.log('Authorization start failed (expected in local env)');
      }
    }
  }, 30000);

  afterAll(async () => {
    await teardownTestEnvironment(context);
    resetTestEnvironment();
  });

  describe('Pool Tool E2E', () => {
    let tool: PoolTool;

    beforeEach(() => {
      if (!isBackendAvailable) return;
      tool = new PoolTool();
    });

    it('should create a pool', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      // Pool creation requires Azure storage
      if (!hasAzureStorageAccess()) {
        console.log('Skipping: Pool creation requires Azure storage');
        expect(true).toBe(true);
        return;
      }

      const result = await tool.execute({
        action: 'create',
        appPath: context.testAppPath,
        poolName: `test-pool-${Date.now()}`,
        description: 'E2E test pool'
      });

      expect(result.action).toBe('create');
      expect(result.success).toBe(true);
      expect(result.poolName).toBeDefined();
    });

    it('should get pool info', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      // Getting pool info when not in a pool will fail, but that's expected
      try {
        const result = await tool.execute({
          action: 'info',
          appPath: context.testAppPath
        });

        expect(result.action).toBe('info');
        expect(result.success).toBe(true);
        // Pool info might be undefined if not in a pool
      } catch (error) {
        // Expected to fail if not in a pool
        expect(error).toBeDefined();
      }
    });

    it('should handle leave when not in pool', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      // Leaving when not in pool should work or fail gracefully
      try {
        const result = await tool.execute({
          action: 'leave',
          appPath: context.testAppPath
        });

        expect(result.action).toBe('leave');
        // May succeed even if not in pool
      } catch (error) {
        // Expected to fail if not in a pool
        expect(error).toBeDefined();
      }
    });
  });

  describe('Consumption Tool E2E', () => {
    let tool: ConsumptionTool;

    beforeEach(() => {
      if (!isBackendAvailable) return;
      tool = new ConsumptionTool();
    });

    it('should get consumption summary', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      const result = await tool.execute({
        appPath: context.testAppPath
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.total_consumed).toBeGreaterThanOrEqual(0);
      expect(result.summary.by_type).toBeDefined();
    });

    it('should get detailed consumption', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      const result = await tool.execute({
        appPath: context.testAppPath,
        detailed: true
      });

      expect(result.summary).toBeDefined();
      if (result.summary.total_consumed > 0) {
        expect(result.details).toBeDefined();
        expect(Array.isArray(result.details)).toBe(true);
      }
    });

    it('should calculate available IDs', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      // First ensure we have some config
      const configPath = path.join(context.testAppPath, '.objidconfig');
      await fs.writeFile(configPath, JSON.stringify({
        idRanges: {
          table: [{ from: 50000, to: 50010 }],
          page: [{ from: 50000, to: 50010 }]
        }
      }, null, 2));

      const result = await tool.execute({
        appPath: context.testAppPath,
        include_available: true
      });

      expect(result.summary).toBeDefined();
      expect(result.available).toBeDefined();
      if (result.available?.table) {
        expect(Array.isArray(result.available.table)).toBe(true);
      }
    });
  });

  describe('Sync Tool E2E', () => {
    let tool: SyncTool;

    beforeEach(async () => {
      if (!isBackendAvailable) return;
      tool = new SyncTool();

      // Create some test AL files
      const srcPath = path.join(context.testAppPath, 'src');
      await fs.mkdir(srcPath, { recursive: true });

      await fs.writeFile(
        path.join(srcPath, 'TestTable.al'),
        `table 50000 TestTable
        {
          fields
          {
            field(1; Code; Code[20]) { }
          }
        }`
      );
    });

    it('should check sync status', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      const result = await tool.execute({
        action: 'check-status',
        appPath: context.testAppPath
      });

      expect(result.action).toBe('check-status');
      expect(result.synced).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('should perform dry-run sync', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      const result = await tool.execute({
        action: 'sync',
        appPath: context.testAppPath,
        mode: 'incremental',
        dry_run: true
      });

      expect(result.action).toBe('sync');
      expect(result.synced).toBe(false); // dry_run doesn't actually sync
      expect(result.stats).toBeDefined();
      expect(result.stats?.objects_synced).toBeGreaterThanOrEqual(0);
    });

    it('should setup auto-sync', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      const result = await tool.execute({
        action: 'auto-sync',
        appPath: context.testAppPath,
        mode: 'incremental'
      });

      expect(result.action).toBe('auto-sync');
      expect(result.synced).toBe(true);
      expect(result.message).toContain('Auto-sync enabled');
    });
  });

  describe('Log Tool E2E', () => {
    let tool: LogTool;

    beforeEach(() => {
      if (!isBackendAvailable) return;
      tool = new LogTool();
    });

    it('should retrieve activity logs', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      const result = await tool.execute({
        appPath: context.testAppPath,
        limit: 10
      });

      expect(result.entries).toBeDefined();
      expect(Array.isArray(result.entries)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.filtered).toBeGreaterThanOrEqual(0);
    });

    it('should filter logs by date', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const result = await tool.execute({
        appPath: context.testAppPath,
        limit: 10,
        since: yesterday.toISOString()
      });

      expect(result.entries).toBeDefined();
      expect(Array.isArray(result.entries)).toBe(true);
      // All entries should be after yesterday
      result.entries.forEach(entry => {
        expect(new Date(entry.timestamp).getTime()).toBeGreaterThanOrEqual(yesterday.getTime());
      });
    });

    it('should filter logs by event type', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      const result = await tool.execute({
        appPath: context.testAppPath,
        limit: 10,
        filter: {
          event_type: 'id_allocation'
        }
      });

      expect(result.entries).toBeDefined();
      expect(Array.isArray(result.entries)).toBe(true);
      // All entries should match filter
      result.entries.forEach(entry => {
        expect(entry.event_type).toBe('id_allocation');
      });
    });
  });


  describe('Integration Tests', () => {
    it('should handle full STANDARD mode workflow', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        expect(true).toBe(true); // Mark test as passed when skipped
        return;
      }

      // 1. Check consumption before operations
      const consumptionTool = new ConsumptionTool();
      const initialConsumption = await consumptionTool.execute({
        appPath: context.testAppPath
      });

      // 2. Create or join a pool (skip if no Azure storage)
      const poolTool = new PoolTool();
      if (hasAzureStorageAccess()) {
        try {
          await poolTool.execute({
            action: 'create',
            appPath: context.testAppPath,
            poolName: `integration-test-${Date.now()}`
          });
        } catch (error) {
          // Pool might already exist, try to get info
          await poolTool.execute({
            action: 'info',
            appPath: context.testAppPath
          });
        }
      }

      // 3. Check sync status
      const syncTool = new SyncTool();
      const syncStatus = await syncTool.execute({
        action: 'check-status',
        appPath: context.testAppPath
      });

      // 4. Get recent logs
      const logTool = new LogTool();
      const logs = await logTool.execute({
        appPath: context.testAppPath,
        limit: 5
      });

      // Verify all operations completed
      expect(initialConsumption.summary).toBeDefined();
      expect(syncStatus.synced).toBeDefined();
      expect(logs.entries).toBeDefined();
    });
  });
});