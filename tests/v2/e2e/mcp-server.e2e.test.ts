/**
 * E2E Tests for MCP Server V2 against local Azure Functions
 */

import {
  TestContext,
  setupTestEnvironment,
  teardownTestEnvironment,
  checkBackendAvailable,
  setTestEnvironment,
  resetTestEnvironment,
  waitFor
} from './setup';
import { AuthorizationTool } from '../../../src/v2/tools/lite/AuthorizationTool';
import { ConfigTool } from '../../../src/v2/tools/lite/ConfigTool';
import { AllocateIdTool } from '../../../src/v2/tools/lite/AllocateIdTool';
import { AnalyzeWorkspaceTool } from '../../../src/v2/tools/lite/AnalyzeWorkspaceTool';
import fs from 'fs/promises';
import path from 'path';

describe('MCP Server V2 E2E Tests', () => {
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
  }, 30000);

  afterAll(async () => {
    await teardownTestEnvironment(context);
    resetTestEnvironment();
  });

  describe('Authorization Tool E2E', () => {
    let tool: AuthorizationTool;

    beforeEach(() => {
      if (!isBackendAvailable) return;
      tool = new AuthorizationTool();
    });

    it('should check authorization status', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        return;
      }

      const result = await tool.execute({
        action: 'status',
        appPath: context.testAppPath
      });

      expect(result).toBeDefined();
      expect(result.action).toBe('status');
      expect(typeof result.authorized).toBe('boolean');
    });

    it('should start authorization flow', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        return;
      }

      // Set up git info for authorization
      process.env.GIT_USER = 'test-user';
      process.env.GIT_EMAIL = 'test@example.com';
      process.env.GIT_REPO = 'https://github.com/test/repo';

      try {
        const result = await tool.execute({
          action: 'start',
          appPath: context.testAppPath,
          interactive: false
        });

        expect(result).toBeDefined();
        expect(result.action).toBe('start');
        expect(result.authorized).toBe(true);
      } catch (error: any) {
        // Expected error in local environment without blob storage
        if (error.message?.includes('Blob operation has timed out')) {
          console.log('Authorization start failed due to missing blob storage (expected in local env)');
          expect(error.message).toContain('Blob operation has timed out');
        } else {
          throw error;
        }
      } finally {
        // Clean up
        delete process.env.GIT_USER;
        delete process.env.GIT_EMAIL;
        delete process.env.GIT_REPO;
      }
    });
  });

  describe('Config Tool E2E', () => {
    let tool: ConfigTool;

    beforeEach(() => {
      if (!isBackendAvailable) return;
      tool = new ConfigTool();
    });

    it('should read configuration', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        return;
      }

      const result = await tool.execute({
        action: 'read',
        appPath: context.testAppPath
      });

      expect(result).toBeDefined();
      expect(result.action).toBe('read');
      expect(result.exists).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config?.idRanges).toBeDefined();
      expect(result.config?.idRanges?.table).toBeDefined();
    });

    it('should validate configuration', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        return;
      }

      const result = await tool.execute({
        action: 'validate',
        appPath: context.testAppPath
      });

      expect(result).toBeDefined();
      expect(result.action).toBe('validate');
      expect(result.exists).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('should write configuration', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        return;
      }

      const patch = {
        objectNameSuffix: '_Test'
      };

      const result = await tool.execute({
        action: 'write',
        appPath: context.testAppPath,
        patch,
        merge: true
      });

      expect(result).toBeDefined();
      expect(result.action).toBe('write');
      expect(result.config?.objectNameSuffix).toBe('_Test');

      // Verify the file was actually updated
      const configPath = path.join(context.testAppPath, '.objidconfig');
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.objectNameSuffix).toBe('_Test');
    });
  });

  describe('Allocate ID Tool E2E', () => {
    let tool: AllocateIdTool;

    beforeEach(() => {
      if (!isBackendAvailable) return;
      tool = new AllocateIdTool();
    });

    it('should preview available IDs', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        return;
      }

      const result = await tool.execute({
        mode: 'preview',
        appPath: context.testAppPath,
        object_type: 'table',
        count: 3
      });

      expect(result).toBeDefined();
      expect(result.mode).toBe('preview');
      expect(result.ids).toBeDefined();
      expect(Array.isArray(result.ids)).toBe(true);
      expect(result.ids.length).toBeLessThanOrEqual(3);
      expect(result.object_type).toBe('table');

      // IDs should be in the configured range
      result.ids.forEach(id => {
        expect(id).toBeGreaterThanOrEqual(50000);
        expect(id).toBeLessThanOrEqual(50019);
      });
    });

    it('should reserve IDs with dry run', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        return;
      }

      const result = await tool.execute({
        mode: 'reserve',
        appPath: context.testAppPath,
        object_type: 'page',
        count: 2,
        dry_run: true
      });

      expect(result).toBeDefined();
      expect(result.mode).toBe('reserve');
      expect(result.dry_run).toBe(true);
      expect(result.reserved).toBe(false);
      expect(result.ids).toBeDefined();
      expect(Array.isArray(result.ids)).toBe(true);
    });

    it('should handle reclaim with empty IDs gracefully', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        return;
      }

      await expect(tool.execute({
        mode: 'reclaim',
        appPath: context.testAppPath,
        object_type: 'codeunit'
      })).rejects.toThrow('ids parameter is required');
    });
  });

  describe('Analyze Workspace Tool E2E', () => {
    let tool: AnalyzeWorkspaceTool;

    beforeEach(() => {
      if (!isBackendAvailable) return;
      tool = new AnalyzeWorkspaceTool();
    });

    it('should analyze workspace summary', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        return;
      }

      const result = await tool.execute({
        appPath: context.testAppPath,
        return_level: 'summary'
      });

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.total_objects).toBeGreaterThanOrEqual(1);
      expect(result.summary.by_type).toBeDefined();
      expect(result.summary.by_type.table).toBeDefined();
      expect(result.summary.collision_count).toBe(0);
    });

    it('should analyze workspace with detailed output', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        return;
      }

      const result = await tool.execute({
        appPath: context.testAppPath,
        return_level: 'detailed',
        detect_collisions: true
      });

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.objects).toBeDefined();
      expect(Array.isArray(result.objects)).toBe(true);

      // Should find our test table
      const table = result.objects?.find(obj => obj.type === 'table' && obj.id === 50000);
      expect(table).toBeDefined();
      expect(table?.name).toContain('Customer');
    });

    it('should detect collisions when present', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        return;
      }

      // Add a duplicate table to create a collision
      const duplicateContent = `table 50000 "TEST Duplicate"
{
    DataClassification = CustomerContent;
    fields
    {
        field(1; "Code"; Code[10])
        {
            DataClassification = CustomerContent;
        }
    }
}`;

      await fs.writeFile(
        path.join(context.testAppPath, 'Duplicate.Table.al'),
        duplicateContent
      );

      const result = await tool.execute({
        appPath: context.testAppPath,
        return_level: 'detailed',
        detect_collisions: true
      });

      expect(result.summary.collision_count).toBeGreaterThan(0);
      expect(result.collisions).toBeDefined();
      expect(result.collisions?.length).toBeGreaterThan(0);

      // Clean up duplicate file
      await fs.unlink(path.join(context.testAppPath, 'Duplicate.Table.al'));
    });
  });

  describe('Integration Flow E2E', () => {
    it('should complete full workflow', async () => {
      if (!isBackendAvailable) {
        console.log('Skipping: Backend not available');
        return;
      }

      // 1. Check authorization
      const authTool = new AuthorizationTool();
      const authStatus = await authTool.execute({
        action: 'status',
        appPath: context.testAppPath
      });
      expect(authStatus).toBeDefined();

      // 2. Read config
      const configTool = new ConfigTool();
      const config = await configTool.execute({
        action: 'read',
        appPath: context.testAppPath
      });
      expect(config.exists).toBe(true);

      // 3. Analyze workspace
      const analyzeTool = new AnalyzeWorkspaceTool();
      const analysis = await analyzeTool.execute({
        appPath: context.testAppPath,
        return_level: 'summary'
      });
      expect(analysis.summary.total_objects).toBeGreaterThan(0);

      // 4. Preview available IDs
      const allocateTool = new AllocateIdTool();
      const preview = await allocateTool.execute({
        mode: 'preview',
        appPath: context.testAppPath,
        object_type: 'page',
        count: 1
      });
      expect(preview.ids.length).toBeGreaterThan(0);

      // 5. Update config
      const configUpdate = await configTool.execute({
        action: 'write',
        appPath: context.testAppPath,
        patch: { objectNamePrefix: 'E2E' },
        merge: true
      });
      expect(configUpdate.config?.objectNamePrefix).toBe('E2E');
    });
  });
});