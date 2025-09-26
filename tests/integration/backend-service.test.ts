/**
 * Real integration tests for BackendService
 * Tests actual API communication with the backend
 */

import { BackendService } from '../../src/lib/backend/BackendService';
import { ConfigManager } from '../../src/lib/config/ConfigManager';
import { Logger } from '../../src/lib/utils/Logger';
import * as path from 'path';
import * as fs from 'fs';

describe('BackendService Integration Tests', () => {
  let backendService: BackendService;
  let configManager: ConfigManager;
  let logger: Logger;
  const testAppPath = path.join(__dirname, '../al');
  let appId: string;
  let authKey: string;

  beforeAll(() => {
    // Load the test app's config
    const objidConfig = JSON.parse(
      fs.readFileSync(path.join(testAppPath, '.objidconfig'), 'utf-8')
    );
    authKey = objidConfig.authKey;

    const appJson = JSON.parse(
      fs.readFileSync(path.join(testAppPath, 'app.json'), 'utf-8')
    );
    appId = appJson.id;
  });

  beforeEach(() => {
    logger = new Logger();
    configManager = new ConfigManager();
    backendService = new BackendService(configManager, logger);
  });

  describe('Authorization API', () => {
    it('should check if app is authorized', async () => {
      const result = await backendService.isAuthorized(appId, authKey);
      expect(result).toBe(true);
    });

    it('should handle invalid auth key', async () => {
      const result = await backendService.isAuthorized(appId, 'invalid-key');
      expect(result).toBe(false);
    });

    it('should get consumption data for authorized app', async () => {
      const result = await backendService.getConsumption(appId, authKey);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('available');
      expect(result).toHaveProperty('consumptions');
    });

    it('should fail to get consumption for unauthorized app', async () => {
      const result = await backendService.getConsumption(appId, 'invalid-key');
      expect(result).toBeUndefined();
    });
  });

  describe('ID Management API', () => {
    it('should get next available ID without committing', async () => {
      const result = await backendService.getNext({
        appId,
        authKey,
        type: 'table',
        ranges: [{ from: 50100, to: 50149 }],
        perRange: false
      }, false);

      expect(result).toBeDefined();
      expect(result?.available).toBe(true);
      expect(result?.id).toBeGreaterThanOrEqual(50100);
      expect(result?.id).toBeLessThanOrEqual(50149);
    });

    it('should handle unavailable IDs gracefully', async () => {
      const result = await backendService.getNext({
        appId,
        authKey,
        type: 'table',
        ranges: [{ from: 1, to: 1 }], // Range with no available IDs
        perRange: false
      }, false);

      expect(result).toBeDefined();
      expect(result?.available).toBe(false);
    });

    it('should get next ID with perRange option', async () => {
      const result = await backendService.getNext({
        appId,
        authKey,
        type: 'page',
        ranges: [
          { from: 50100, to: 50109 },
          { from: 50120, to: 50129 }
        ],
        perRange: true
      }, false);

      expect(result).toBeDefined();
      if (result?.available && Array.isArray(result.id)) {
        expect(result.id).toHaveLength(2);
        expect(result.id[0]).toBeGreaterThanOrEqual(50100);
        expect(result.id[0]).toBeLessThanOrEqual(50109);
        expect(result.id[1]).toBeGreaterThanOrEqual(50120);
        expect(result.id[1]).toBeLessThanOrEqual(50129);
      }
    });

    it('should sync multiple IDs', async () => {
      const objectIds = [
        { type: 'table', id: 50100 },
        { type: 'page', id: 50100 },
        { type: 'codeunit', id: 50100 }
      ];

      const result = await backendService.syncIds(appId, authKey, objectIds);
      expect(result).toBe(true);
    });

    it('should fail sync with invalid auth', async () => {
      const objectIds = [{ type: 'table', id: 50100 }];
      const result = await backendService.syncIds(appId, 'invalid-key', objectIds);
      expect(result).toBe(false);
    });
  });

  describe('Pool Management API', () => {
    let poolId: string;

    it('should check if pool operations require authorization', async () => {
      // Most pool operations require auth, but we can test the flow
      const result = await backendService.createPool('TestPool', [appId], authKey);

      if (result) {
        poolId = result.poolId;
        expect(result).toHaveProperty('poolId');
        expect(result).toHaveProperty('name');
        expect(result.name).toBe('TestPool');
      } else {
        // Pool creation might fail if app is already in a pool
        expect(result).toBeNull();
      }
    });

    it('should handle joining non-existent pool', async () => {
      const result = await backendService.joinPool(appId, 'non-existent-pool', authKey);
      expect(result).toBe(false);
    });

    afterAll(async () => {
      // Clean up: leave pool if we created/joined one
      if (poolId) {
        await backendService.leavePool(appId, authKey);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Temporarily change backend URL to invalid one
      const originalUrl = configManager.getBackendUrl();
      configManager.setBackendUrl('http://invalid-url-that-does-not-exist.com');

      const result = await backendService.isAuthorized(appId, authKey);
      expect(result).toBe(false);

      // Restore original URL
      configManager.setBackendUrl(originalUrl);
    });

    it('should handle malformed responses', async () => {
      // This is hard to test with real API, but we can test invalid parameters
      const result = await backendService.getNext({
        appId: '',
        authKey: '',
        type: 'invalid' as any,
        ranges: [],
        perRange: false
      }, false);

      expect(result).toBeUndefined();
    });

    it('should handle rate limiting gracefully', async () => {
      // Make multiple rapid requests to test rate limit handling
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          backendService.isAuthorized(appId, authKey)
        );
      }

      const results = await Promise.all(promises);
      // All should complete without throwing
      expect(results.every(r => typeof r === 'boolean')).toBe(true);
    });
  });

  describe('Request Building', () => {
    it('should properly format GET requests', async () => {
      // Test that GET requests work correctly
      const result = await backendService.getNext({
        appId,
        authKey,
        type: 'table',
        ranges: [{ from: 50100, to: 50149 }],
        perRange: false
      }, false); // false = GET request

      expect(result).toBeDefined();
    });

    it('should properly format POST requests', async () => {
      // Test that POST requests work correctly
      const objectIds = [{ type: 'report', id: 50100 }];
      const result = await backendService.syncIds(appId, authKey, objectIds);

      expect(typeof result).toBe('boolean');
    });

    it('should handle special characters in parameters', async () => {
      // Test with special characters in app name (for pool creation)
      const result = await backendService.createPool(
        'Test Pool & Special < > Characters',
        [appId],
        authKey
      );

      // Should either succeed or fail gracefully
      expect(result === null || result?.poolId !== undefined).toBe(true);

      if (result) {
        await backendService.leavePool(appId, authKey);
      }
    });
  });

  describe('Response Validation', () => {
    it('should validate authorization response format', async () => {
      const result = await backendService.isAuthorized(appId, authKey);
      expect(typeof result).toBe('boolean');
    });

    it('should validate consumption response format', async () => {
      const result = await backendService.getConsumption(appId, authKey);
      if (result) {
        expect(result).toHaveProperty('total');
        expect(typeof result.total).toBe('number');
        expect(result).toHaveProperty('available');
        expect(typeof result.available).toBe('number');
        expect(result).toHaveProperty('consumptions');
        expect(Array.isArray(result.consumptions)).toBe(true);
      }
    });

    it('should validate next ID response format', async () => {
      const result = await backendService.getNext({
        appId,
        authKey,
        type: 'xmlport',
        ranges: [{ from: 50100, to: 50149 }],
        perRange: false
      }, false);

      if (result) {
        expect(result).toHaveProperty('available');
        expect(typeof result.available).toBe('boolean');
        if (result.available) {
          expect(result).toHaveProperty('id');
          expect(
            typeof result.id === 'number' || Array.isArray(result.id)
          ).toBe(true);
        }
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent authorization checks', async () => {
      const promises = Array(5).fill(null).map(() =>
        backendService.isAuthorized(appId, authKey)
      );

      const results = await Promise.all(promises);
      expect(results.every(r => r === true)).toBe(true);
    });

    it('should handle concurrent ID requests', async () => {
      const promises = Array(3).fill(null).map((_, i) =>
        backendService.getNext({
          appId,
          authKey,
          type: i === 0 ? 'table' : i === 1 ? 'page' : 'codeunit',
          ranges: [{ from: 50100, to: 50149 }],
          perRange: false
        }, false)
      );

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeDefined();
        if (result?.available) {
          expect(result.id).toBeGreaterThanOrEqual(50100);
        }
      });
    });

    it('should handle mixed concurrent operations', async () => {
      const promises = [
        backendService.isAuthorized(appId, authKey),
        backendService.getConsumption(appId, authKey),
        backendService.getNext({
          appId,
          authKey,
          type: 'enum',
          ranges: [{ from: 50100, to: 50149 }],
          perRange: false
        }, false)
      ];

      const results = await Promise.allSettled(promises);
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });
});