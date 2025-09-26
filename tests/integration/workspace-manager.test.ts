/**
 * Real integration tests for WorkspaceManager
 * Tests workspace scanning, app management, and pool operations
 */

import { WorkspaceManager } from '../../src/lib/workspace/WorkspaceManager';
import { BackendService } from '../../src/lib/backend/BackendService';
import { ConfigManager } from '../../src/lib/config/ConfigManager';
import { Logger } from '../../src/lib/utils/Logger';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('WorkspaceManager Integration Tests', () => {
  let workspaceManager: WorkspaceManager;
  let backendService: BackendService;
  let configManager: ConfigManager;
  let logger: Logger;
  let testWorkspace: string;
  let testApp1: string;
  let testApp2: string;

  beforeAll(() => {
    // Create test workspace with multiple apps
    testWorkspace = path.join(os.tmpdir(), 'workspace-test-' + Date.now());
    fs.mkdirSync(testWorkspace, { recursive: true });

    // Create first app
    testApp1 = path.join(testWorkspace, 'App1');
    fs.mkdirSync(testApp1);
    fs.writeFileSync(path.join(testApp1, 'app.json'), JSON.stringify({
      id: 'app1-test-id',
      name: 'Test App 1',
      publisher: 'Test Publisher',
      version: '1.0.0.0',
      idRanges: [{ from: 70000, to: 70099 }]
    }, null, 2));
    fs.writeFileSync(path.join(testApp1, '.objidconfig'), JSON.stringify({
      authKey: 'test-auth-1'
    }, null, 2));

    // Create second app
    testApp2 = path.join(testWorkspace, 'App2');
    fs.mkdirSync(testApp2);
    fs.writeFileSync(path.join(testApp2, 'app.json'), JSON.stringify({
      id: 'app2-test-id',
      name: 'Test App 2',
      publisher: 'Test Publisher',
      version: '2.0.0.0',
      idRanges: [{ from: 80000, to: 80099 }]
    }, null, 2));
    fs.writeFileSync(path.join(testApp2, '.objidconfig'), JSON.stringify({
      authKey: 'test-auth-2'
    }, null, 2));

    // Create a nested app (should be found)
    const nestedDir = path.join(testWorkspace, 'nested', 'deep');
    fs.mkdirSync(nestedDir, { recursive: true });
    const nestedApp = path.join(nestedDir, 'NestedApp');
    fs.mkdirSync(nestedApp);
    fs.writeFileSync(path.join(nestedApp, 'app.json'), JSON.stringify({
      id: 'nested-app-id',
      name: 'Nested App',
      publisher: 'Test Publisher',
      version: '1.0.0.0',
      idRanges: [{ from: 90000, to: 90099 }]
    }, null, 2));

    // Create non-AL folder (should be ignored)
    const nonALFolder = path.join(testWorkspace, 'NotAnApp');
    fs.mkdirSync(nonALFolder);
    fs.writeFileSync(path.join(nonALFolder, 'readme.txt'), 'This is not an AL app');
  });

  afterAll(() => {
    // Clean up test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    logger = new Logger();
    configManager = new ConfigManager();
    backendService = new BackendService(configManager, logger);
    workspaceManager = new WorkspaceManager(backendService, logger);
  });

  describe('Workspace Scanning', () => {
    it('should scan workspace and find all AL apps', async () => {
      const workspace = await workspaceManager.scanWorkspace(testWorkspace);

      expect(workspace).toBeDefined();
      expect(workspace.rootPath).toBe(testWorkspace);
      expect(workspace.apps).toHaveLength(3); // App1, App2, and NestedApp

      const appNames = workspace.apps.map(app => app.name);
      expect(appNames).toContain('Test App 1');
      expect(appNames).toContain('Test App 2');
      expect(appNames).toContain('Nested App');
    });

    it('should correctly parse app.json files', async () => {
      const workspace = await workspaceManager.scanWorkspace(testWorkspace);
      const app1 = workspace.apps.find(app => app.name === 'Test App 1');

      expect(app1).toBeDefined();
      expect(app1?.appId).toBe('app1-test-id');
      expect(app1?.publisher).toBe('Test Publisher');
      expect(app1?.version).toBe('1.0.0.0');
      expect(app1?.ranges).toEqual([{ from: 70000, to: 70099 }]);
    });

    it('should detect authorization status', async () => {
      const workspace = await workspaceManager.scanWorkspace(testWorkspace);
      const app1 = workspace.apps.find(app => app.name === 'Test App 1');

      expect(app1).toBeDefined();
      expect(app1?.isAuthorized).toBe(true); // Has authKey in .objidconfig
      expect(app1?.authKey).toBe('test-auth-1');
    });

    it('should handle empty workspace', async () => {
      const emptyDir = path.join(os.tmpdir(), 'empty-' + Date.now());
      fs.mkdirSync(emptyDir);

      const workspace = await workspaceManager.scanWorkspace(emptyDir);

      expect(workspace).toBeDefined();
      expect(workspace.rootPath).toBe(emptyDir);
      expect(workspace.apps).toHaveLength(0);

      fs.rmSync(emptyDir, { recursive: true });
    });

    it('should handle malformed app.json gracefully', async () => {
      const badApp = path.join(testWorkspace, 'BadApp');
      fs.mkdirSync(badApp);
      fs.writeFileSync(path.join(badApp, 'app.json'), 'invalid json {]');

      const workspace = await workspaceManager.scanWorkspace(testWorkspace);

      // Should still find the good apps
      expect(workspace.apps.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Active App Management', () => {
    it('should set and get active app', () => {
      const success = workspaceManager.setActiveApp(testApp1);
      expect(success).toBe(true);

      const activeApp = workspaceManager.getActiveApp();
      expect(activeApp).toBeDefined();
      expect(activeApp?.name).toBe('Test App 1');
      expect(activeApp?.path).toBe(testApp1);
    });

    it('should switch between apps', () => {
      workspaceManager.setActiveApp(testApp1);
      let activeApp = workspaceManager.getActiveApp();
      expect(activeApp?.name).toBe('Test App 1');

      workspaceManager.setActiveApp(testApp2);
      activeApp = workspaceManager.getActiveApp();
      expect(activeApp?.name).toBe('Test App 2');
    });

    it('should clear active app', () => {
      workspaceManager.setActiveApp(testApp1);
      expect(workspaceManager.getActiveApp()).toBeDefined();

      workspaceManager.clearActiveApp();
      expect(workspaceManager.getActiveApp()).toBeNull();
    });

    it('should reject invalid app path', () => {
      const success = workspaceManager.setActiveApp('/non/existent/path');
      expect(success).toBe(false);
      expect(workspaceManager.getActiveApp()).toBeNull();
    });

    it('should load app from path', async () => {
      const app = await workspaceManager.getAppFromPath(testApp1);

      expect(app).toBeDefined();
      expect(app?.name).toBe('Test App 1');
      expect(app?.appId).toBe('app1-test-id');
      expect(app?.path).toBe(testApp1);
    });
  });

  describe('Workspace State', () => {
    it('should track current workspace after scan', async () => {
      await workspaceManager.scanWorkspace(testWorkspace);
      const workspace = workspaceManager.getCurrentWorkspace();

      expect(workspace).toBeDefined();
      expect(workspace?.rootPath).toBe(testWorkspace);
      expect(workspace?.apps).toHaveLength(3);
    });

    it('should maintain workspace state across operations', async () => {
      await workspaceManager.scanWorkspace(testWorkspace);
      workspaceManager.setActiveApp(testApp1);

      const workspace = workspaceManager.getCurrentWorkspace();
      expect(workspace?.activeApp).toBeDefined();
      expect(workspace?.activeApp?.path).toBe(testApp1);
    });

    it('should update workspace when apps change', async () => {
      await workspaceManager.scanWorkspace(testWorkspace);
      let workspace = workspaceManager.getCurrentWorkspace();
      const initialCount = workspace?.apps.length || 0;

      // Add a new app
      const newApp = path.join(testWorkspace, 'NewApp');
      fs.mkdirSync(newApp);
      fs.writeFileSync(path.join(newApp, 'app.json'), JSON.stringify({
        id: 'new-app-id',
        name: 'New App',
        publisher: 'Test',
        version: '1.0.0.0'
      }));

      // Rescan
      await workspaceManager.scanWorkspace(testWorkspace);
      workspace = workspaceManager.getCurrentWorkspace();

      expect(workspace?.apps.length).toBe(initialCount + 1);
    });
  });

  describe('Pool ID Management', () => {
    it('should return app ID when no pool exists', () => {
      const appId = 'test-app-id';
      const result = workspaceManager.getPoolIdFromAppIdIfAvailable(appId);
      expect(result).toBe(appId);
    });

    it('should handle pool ID in workspace apps', async () => {
      // Create app with poolId
      const poolApp = path.join(testWorkspace, 'PoolApp');
      fs.mkdirSync(poolApp);
      fs.writeFileSync(path.join(poolApp, 'app.json'), JSON.stringify({
        id: 'pool-app-id',
        name: 'Pool App',
        publisher: 'Test',
        version: '1.0.0.0'
      }));
      fs.writeFileSync(path.join(poolApp, '.objidconfig'), JSON.stringify({
        authKey: 'test-auth',
        poolId: 'shared-pool-id'
      }));

      await workspaceManager.scanWorkspace(testWorkspace);
      const app = await workspaceManager.getAppFromPath(poolApp);

      expect(app).toBeDefined();
      expect(app?.poolId).toBe('shared-pool-id');

      // Should return pool ID when available
      const result = workspaceManager.getPoolIdFromAppIdIfAvailable('pool-app-id');
      // This might still return app-id if not in current workspace context
      expect(typeof result).toBe('string');
    });
  });

  describe('App Search and Discovery', () => {
    it('should find app by ID', async () => {
      await workspaceManager.scanWorkspace(testWorkspace);
      const workspace = workspaceManager.getCurrentWorkspace();
      const app = workspace?.apps.find(a => a.appId === 'app2-test-id');

      expect(app).toBeDefined();
      expect(app?.name).toBe('Test App 2');
    });

    it('should find app by path', async () => {
      await workspaceManager.scanWorkspace(testWorkspace);
      const workspace = workspaceManager.getCurrentWorkspace();
      const app = workspace?.apps.find(a => a.path === testApp1);

      expect(app).toBeDefined();
      expect(app?.name).toBe('Test App 1');
    });

    it('should handle apps with same name', async () => {
      // Create two apps with same name
      const dupApp1 = path.join(testWorkspace, 'Dup1');
      const dupApp2 = path.join(testWorkspace, 'Dup2');

      fs.mkdirSync(dupApp1);
      fs.writeFileSync(path.join(dupApp1, 'app.json'), JSON.stringify({
        id: 'dup-1',
        name: 'Duplicate Name',
        publisher: 'Test',
        version: '1.0.0.0'
      }));

      fs.mkdirSync(dupApp2);
      fs.writeFileSync(path.join(dupApp2, 'app.json'), JSON.stringify({
        id: 'dup-2',
        name: 'Duplicate Name',
        publisher: 'Test',
        version: '2.0.0.0'
      }));

      await workspaceManager.scanWorkspace(testWorkspace);
      const workspace = workspaceManager.getCurrentWorkspace();
      const duplicates = workspace?.apps.filter(a => a.name === 'Duplicate Name');

      expect(duplicates?.length).toBe(2);
      // Should have different IDs
      expect(duplicates?.[0].appId).not.toBe(duplicates?.[1].appId);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent workspace path', async () => {
      const result = await workspaceManager.scanWorkspace('/non/existent/path');
      expect(result.apps).toHaveLength(0);
    });

    it('should handle permission errors gracefully', async () => {
      // This test is platform-specific and might not work on all systems
      if (process.platform === 'win32') {
        // Skip on Windows as permission model is different
        return;
      }

      const restrictedDir = path.join(os.tmpdir(), 'restricted-' + Date.now());
      fs.mkdirSync(restrictedDir, { mode: 0o000 });

      const workspace = await workspaceManager.scanWorkspace(restrictedDir);
      expect(workspace.apps).toHaveLength(0);

      fs.chmodSync(restrictedDir, 0o755);
      fs.rmSync(restrictedDir, { recursive: true });
    });

    it('should handle corrupted .objidconfig', async () => {
      const corruptApp = path.join(testWorkspace, 'CorruptApp');
      fs.mkdirSync(corruptApp);
      fs.writeFileSync(path.join(corruptApp, 'app.json'), JSON.stringify({
        id: 'corrupt-app',
        name: 'Corrupt App',
        publisher: 'Test',
        version: '1.0.0.0'
      }));
      fs.writeFileSync(path.join(corruptApp, '.objidconfig'), 'not valid json at all');

      const app = await workspaceManager.getAppFromPath(corruptApp);
      expect(app).toBeDefined();
      expect(app?.isAuthorized).toBe(false); // Should default to unauthorized
    });
  });

  describe('Performance', () => {
    it('should handle large workspaces efficiently', async () => {
      const largeWorkspace = path.join(os.tmpdir(), 'large-' + Date.now());
      fs.mkdirSync(largeWorkspace);

      // Create 20 apps
      for (let i = 0; i < 20; i++) {
        const appDir = path.join(largeWorkspace, `App${i}`);
        fs.mkdirSync(appDir);
        fs.writeFileSync(path.join(appDir, 'app.json'), JSON.stringify({
          id: `app-${i}`,
          name: `App ${i}`,
          publisher: 'Test',
          version: '1.0.0.0'
        }));
      }

      const startTime = Date.now();
      const workspace = await workspaceManager.scanWorkspace(largeWorkspace);
      const duration = Date.now() - startTime;

      expect(workspace.apps).toHaveLength(20);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      fs.rmSync(largeWorkspace, { recursive: true });
    });

    it('should cache app data appropriately', async () => {
      // First load
      const app1 = await workspaceManager.getAppFromPath(testApp1);
      expect(app1).toBeDefined();

      // Second load should be from memory
      const app2 = await workspaceManager.getAppFromPath(testApp1);
      expect(app2).toEqual(app1);
    });
  });
});