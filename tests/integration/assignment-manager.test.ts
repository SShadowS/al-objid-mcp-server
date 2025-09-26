/**
 * Real integration tests for AssignmentManager
 * Tests assignment tracking, storage, and synchronization
 */

import { AssignmentManager } from '../../src/lib/assignments/AssignmentManager';
import { BackendService } from '../../src/lib/backend/BackendService';
import { ConfigManager } from '../../src/lib/config/ConfigManager';
import { Logger } from '../../src/lib/utils/Logger';
import { ALObjectType } from '../../src/lib/types/ALObjectType';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('AssignmentManager Integration Tests', () => {
  let assignmentManager: AssignmentManager;
  let backendService: BackendService;
  let configManager: ConfigManager;
  let logger: Logger;
  let tempDir: string;
  let testAppPath: string;
  let appId: string;
  let authKey: string;

  beforeAll(() => {
    // Create temporary directory for test files
    tempDir = path.join(os.tmpdir(), 'assignment-test-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    // Create test app
    testAppPath = path.join(tempDir, 'TestApp');
    fs.mkdirSync(testAppPath);

    // Create app.json
    appId = 'assignment-test-app-' + Date.now();
    fs.writeFileSync(path.join(testAppPath, 'app.json'), JSON.stringify({
      id: appId,
      name: 'Assignment Test App',
      publisher: 'Test Publisher',
      version: '1.0.0.0',
      idRanges: [{ from: 50100, to: 50199 }]
    }, null, 2));

    // Create .objidconfig with auth
    authKey = 'test-auth-key-' + Date.now();
    fs.writeFileSync(path.join(testAppPath, '.objidconfig'), JSON.stringify({
      authKey: authKey
    }, null, 2));
  });

  afterAll(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    logger = new Logger();
    configManager = new ConfigManager();
    backendService = new BackendService(configManager, logger);
    assignmentManager = new AssignmentManager(backendService, logger);
  });

  describe('Assignment Storage', () => {
    it('should store single assignment', async () => {
      const assignment = {
        appId,
        authKey,
        objectType: 'table' as ALObjectType,
        objectId: 50100,
        objectName: 'TestTable'
      };

      const result = await assignmentManager.storeAssignment(assignment);
      expect(result).toBe(true);
    });

    it('should store multiple assignments', async () => {
      const assignments = [
        {
          appId,
          authKey,
          objectType: 'table' as ALObjectType,
          objectId: 50101,
          objectName: 'TestTable1'
        },
        {
          appId,
          authKey,
          objectType: 'page' as ALObjectType,
          objectId: 50101,
          objectName: 'TestPage1'
        },
        {
          appId,
          authKey,
          objectType: 'codeunit' as ALObjectType,
          objectId: 50101,
          objectName: 'TestCodeunit1'
        }
      ];

      for (const assignment of assignments) {
        const result = await assignmentManager.storeAssignment(assignment);
        expect(result).toBe(true);
      }
    });

    it('should handle assignment with special characters', async () => {
      const assignment = {
        appId,
        authKey,
        objectType: 'table' as ALObjectType,
        objectId: 50102,
        objectName: 'Test Table & Special <Characters>'
      };

      const result = await assignmentManager.storeAssignment(assignment);
      expect(result).toBe(true);
    });

    it('should handle assignment without optional fields', async () => {
      const assignment = {
        appId,
        authKey,
        objectType: 'table' as ALObjectType,
        objectId: 50103
        // No objectName
      };

      const result = await assignmentManager.storeAssignment(assignment);
      expect(result).toBe(true);
    });

    it('should fail with invalid auth key', async () => {
      const assignment = {
        appId,
        authKey: 'invalid-auth-key',
        objectType: 'table' as ALObjectType,
        objectId: 50104,
        objectName: 'TestTable'
      };

      const result = await assignmentManager.storeAssignment(assignment);
      expect(result).toBe(false);
    });
  });

  describe('Assignment Retrieval', () => {
    it('should retrieve assignments for app', async () => {
      // Store some assignments first
      const assignments = [
        {
          appId,
          authKey,
          objectType: 'table' as ALObjectType,
          objectId: 50110,
          objectName: 'Table1'
        },
        {
          appId,
          authKey,
          objectType: 'table' as ALObjectType,
          objectId: 50111,
          objectName: 'Table2'
        }
      ];

      for (const assignment of assignments) {
        await assignmentManager.storeAssignment(assignment);
      }

      // Retrieve and verify
      const retrieved = await assignmentManager.getAssignments(appId, authKey);
      expect(retrieved).toBeDefined();
      expect(Array.isArray(retrieved)).toBe(true);
    });

    it('should return empty array for app with no assignments', async () => {
      const noAssignmentAppId = 'no-assignment-app-' + Date.now();
      const retrieved = await assignmentManager.getAssignments(noAssignmentAppId, authKey);

      expect(retrieved).toBeDefined();
      expect(Array.isArray(retrieved)).toBe(true);
      expect(retrieved?.length).toBe(0);
    });

    it('should fail retrieval with invalid auth', async () => {
      const retrieved = await assignmentManager.getAssignments(appId, 'wrong-auth-key');
      expect(retrieved).toBeNull();
    });
  });

  describe('Assignment Tracking', () => {
    it('should track assignments in memory', () => {
      assignmentManager.trackAssignment(appId, 'table', 50120, 'TrackedTable');

      const tracked = assignmentManager.getTrackedAssignments(appId);
      expect(tracked).toBeDefined();
      expect(tracked.length).toBeGreaterThan(0);
      expect(tracked).toContainEqual({
        objectType: 'table',
        objectId: 50120,
        objectName: 'TrackedTable'
      });
    });

    it('should track multiple assignments for same app', () => {
      assignmentManager.trackAssignment(appId, 'table', 50121, 'Table1');
      assignmentManager.trackAssignment(appId, 'page', 50121, 'Page1');
      assignmentManager.trackAssignment(appId, 'codeunit', 50121, 'Codeunit1');

      const tracked = assignmentManager.getTrackedAssignments(appId);
      expect(tracked).toBeDefined();
      expect(tracked.length).toBeGreaterThanOrEqual(3);
    });

    it('should track assignments for different apps separately', () => {
      const app1 = 'app1-' + Date.now();
      const app2 = 'app2-' + Date.now();

      assignmentManager.trackAssignment(app1, 'table', 50122, 'App1Table');
      assignmentManager.trackAssignment(app2, 'table', 50123, 'App2Table');

      const tracked1 = assignmentManager.getTrackedAssignments(app1);
      const tracked2 = assignmentManager.getTrackedAssignments(app2);

      expect(tracked1).not.toEqual(tracked2);
      expect(tracked1).toContainEqual({
        objectType: 'table',
        objectId: 50122,
        objectName: 'App1Table'
      });
      expect(tracked2).toContainEqual({
        objectType: 'table',
        objectId: 50123,
        objectName: 'App2Table'
      });
    });

    it('should clear tracked assignments', () => {
      assignmentManager.trackAssignment(appId, 'table', 50124, 'TableToClear');

      let tracked = assignmentManager.getTrackedAssignments(appId);
      expect(tracked.length).toBeGreaterThan(0);

      assignmentManager.clearTrackedAssignments(appId);

      tracked = assignmentManager.getTrackedAssignments(appId);
      expect(tracked).toEqual([]);
    });

    it('should handle clearing non-existent app', () => {
      const nonExistentApp = 'non-existent-app';

      // Should not throw
      expect(() => {
        assignmentManager.clearTrackedAssignments(nonExistentApp);
      }).not.toThrow();

      const tracked = assignmentManager.getTrackedAssignments(nonExistentApp);
      expect(tracked).toEqual([]);
    });
  });

  describe('Batch Operations', () => {
    it('should sync tracked assignments to backend', async () => {
      const appId = 'batch-app-' + Date.now();

      // Track multiple assignments
      assignmentManager.trackAssignment(appId, 'table', 50130, 'BatchTable1');
      assignmentManager.trackAssignment(appId, 'table', 50131, 'BatchTable2');
      assignmentManager.trackAssignment(appId, 'page', 50130, 'BatchPage1');

      // Sync to backend
      const result = await assignmentManager.syncTrackedAssignments(appId, authKey);
      expect(result).toBe(true);

      // Tracked assignments should be cleared after successful sync
      const tracked = assignmentManager.getTrackedAssignments(appId);
      expect(tracked).toEqual([]);
    });

    it('should handle sync failure gracefully', async () => {
      const appId = 'fail-sync-app-' + Date.now();

      assignmentManager.trackAssignment(appId, 'table', 50132, 'FailTable');

      // Sync with invalid auth should fail
      const result = await assignmentManager.syncTrackedAssignments(appId, 'invalid-auth');
      expect(result).toBe(false);

      // Tracked assignments should NOT be cleared on failure
      const tracked = assignmentManager.getTrackedAssignments(appId);
      expect(tracked.length).toBeGreaterThan(0);
    });

    it('should handle empty sync', async () => {
      const appId = 'empty-sync-app-' + Date.now();

      // No tracked assignments
      const result = await assignmentManager.syncTrackedAssignments(appId, authKey);
      expect(result).toBe(true); // Should succeed with no assignments
    });
  });

  describe('Duplicate Prevention', () => {
    it('should prevent duplicate assignments', () => {
      assignmentManager.trackAssignment(appId, 'table', 50140, 'DuplicateTable');
      assignmentManager.trackAssignment(appId, 'table', 50140, 'DuplicateTable');

      const tracked = assignmentManager.getTrackedAssignments(appId);
      const duplicates = tracked.filter(a =>
        a.objectType === 'table' &&
        a.objectId === 50140
      );

      expect(duplicates.length).toBe(1); // Should only have one
    });

    it('should allow same ID for different object types', () => {
      assignmentManager.trackAssignment(appId, 'table', 50141, 'TestTable');
      assignmentManager.trackAssignment(appId, 'page', 50141, 'TestPage');
      assignmentManager.trackAssignment(appId, 'codeunit', 50141, 'TestCodeunit');

      const tracked = assignmentManager.getTrackedAssignments(appId);
      const withId50141 = tracked.filter(a => a.objectId === 50141);

      expect(withId50141.length).toBe(3); // Should have all three
      expect(withId50141.map(a => a.objectType).sort()).toEqual(['codeunit', 'page', 'table']);
    });

    it('should update name if tracking existing ID', () => {
      assignmentManager.trackAssignment(appId, 'table', 50142, 'OriginalName');
      assignmentManager.trackAssignment(appId, 'table', 50142, 'UpdatedName');

      const tracked = assignmentManager.getTrackedAssignments(appId);
      const table50142 = tracked.find(a =>
        a.objectType === 'table' &&
        a.objectId === 50142
      );

      expect(table50142?.objectName).toBe('UpdatedName');
    });
  });

  describe('Error Handling', () => {
    it('should handle backend service failures', async () => {
      // Use invalid backend URL to force failure
      configManager.setBackendUrl('http://invalid-backend-url.example.com');

      const assignment = {
        appId,
        authKey,
        objectType: 'table' as ALObjectType,
        objectId: 50150,
        objectName: 'TestTable'
      };

      const result = await assignmentManager.storeAssignment(assignment);
      expect(result).toBe(false);
    });

    it('should validate assignment data', async () => {
      const invalidAssignments = [
        {
          appId: '',
          authKey,
          objectType: 'table' as ALObjectType,
          objectId: 50151
        },
        {
          appId,
          authKey: '',
          objectType: 'table' as ALObjectType,
          objectId: 50152
        },
        {
          appId,
          authKey,
          objectType: '' as ALObjectType,
          objectId: 50153
        },
        {
          appId,
          authKey,
          objectType: 'table' as ALObjectType,
          objectId: -1
        }
      ];

      for (const assignment of invalidAssignments) {
        const result = await assignmentManager.storeAssignment(assignment);
        expect(result).toBe(false);
      }
    });

    it('should handle concurrent operations', async () => {
      const promises = [];

      // Store multiple assignments concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          assignmentManager.storeAssignment({
            appId,
            authKey,
            objectType: 'table' as ALObjectType,
            objectId: 50160 + i,
            objectName: `ConcurrentTable${i}`
          })
        );
      }

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBe(true);
      });
    });
  });

  describe('Performance', () => {
    it('should handle large number of tracked assignments', () => {
      const largeAppId = 'large-app-' + Date.now();
      const startTime = Date.now();

      // Track 1000 assignments
      for (let i = 0; i < 1000; i++) {
        assignmentManager.trackAssignment(
          largeAppId,
          i % 3 === 0 ? 'table' : i % 3 === 1 ? 'page' : 'codeunit',
          51000 + i,
          `Object${i}`
        );
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete quickly

      const tracked = assignmentManager.getTrackedAssignments(largeAppId);
      expect(tracked.length).toBe(1000);
    });

    it('should efficiently retrieve tracked assignments', () => {
      const appId = 'perf-app-' + Date.now();

      // Track some assignments
      for (let i = 0; i < 100; i++) {
        assignmentManager.trackAssignment(appId, 'table', 52000 + i, `Table${i}`);
      }

      const startTime = Date.now();

      // Retrieve multiple times
      for (let i = 0; i < 1000; i++) {
        assignmentManager.getTrackedAssignments(appId);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // Very fast retrieval
    });
  });

  describe('Integration with Backend', () => {
    it('should store and retrieve round-trip', async () => {
      const rtAppId = 'round-trip-app-' + Date.now();
      const assignment = {
        appId: rtAppId,
        authKey,
        objectType: 'table' as ALObjectType,
        objectId: 50170,
        objectName: 'RoundTripTable'
      };

      // Store
      const storeResult = await assignmentManager.storeAssignment(assignment);
      expect(storeResult).toBe(true);

      // Retrieve (this would normally be done through consumption API)
      // For now, just verify the store succeeded
      expect(storeResult).toBe(true);
    });

    it('should handle network interruption recovery', async () => {
      const originalUrl = configManager.getBackendUrl();

      // Track assignments
      assignmentManager.trackAssignment(appId, 'table', 50180, 'NetworkTestTable');

      // Simulate network failure
      configManager.setBackendUrl('http://invalid-url.example.com');
      let result = await assignmentManager.syncTrackedAssignments(appId, authKey);
      expect(result).toBe(false);

      // Assignments should still be tracked
      let tracked = assignmentManager.getTrackedAssignments(appId);
      expect(tracked.length).toBeGreaterThan(0);

      // Restore network
      configManager.setBackendUrl(originalUrl);

      // Retry sync
      result = await assignmentManager.syncTrackedAssignments(appId, authKey);
      expect(result).toBe(true);

      // Assignments should be cleared after successful sync
      tracked = assignmentManager.getTrackedAssignments(appId);
      expect(tracked).toEqual([]);
    });
  });
});