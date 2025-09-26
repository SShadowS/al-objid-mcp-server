/**
 * Integration tests for BackendService
 * Tests our BackendService implementation against the real Azure backend
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { BackendService } from '../../src/lib/backend/BackendService';
import { ALObjectType } from '../../src/lib/types/ALObjectType';
import { ObjectConsumptions } from '../../src/lib/types/BackendTypes';

// Test configuration
const TEST_APP_PATH = path.join(__dirname, '../al');

// Load test app credentials
const appJson = JSON.parse(
  fs.readFileSync(path.join(TEST_APP_PATH, 'app.json'), 'utf-8')
);
// Remove comments from JSONC file
const objidConfigContent = fs.readFileSync(path.join(TEST_APP_PATH, '.objidconfig'), 'utf-8');
const objidConfig = JSON.parse(
  objidConfigContent.replace(/\/\/.*$/gm, '') // Remove single-line comments
);

// Convert GUID to SHA256 hash as the backend expects
const TEST_APP_ID = crypto.createHash('sha256').update(appJson.id).digest('hex');
const TEST_AUTH_KEY = objidConfig.authKey;

// Create BackendService instance
const backendService = new BackendService();

describe('BackendService Integration Tests', () => {
  describe('checkApp', () => {
    it('should check if test app is managed', async () => {
      const response = await backendService.checkApp(TEST_APP_ID);
      expect(response.managed).toBe(true);
    });

    it('should return false for non-existent app', async () => {
      const response = await backendService.checkApp('non-existent-app-id');
      expect(response.managed).toBe(false);
    });
  });

  describe('getConsumption', () => {
    it('should get consumption data for authorized app', async () => {
      const response = await backendService.getConsumption({
        appId: TEST_APP_ID,
        authKey: TEST_AUTH_KEY
      });

      expect(response).toBeDefined();
      expect(response?._total).toBeDefined();
      expect(typeof response?._total).toBe('number');
    });

    it('should return undefined with invalid auth key', async () => {
      const response = await backendService.getConsumption({
        appId: TEST_APP_ID,
        authKey: 'invalid-auth-key'
      });

      // getConsumption returns undefined on error
      expect(response).toBeUndefined();
    });
  });

  describe('getNext', () => {
    it('should get next available table ID', async () => {
      const response = await backendService.getNext({
        appId: TEST_APP_ID,
        authKey: TEST_AUTH_KEY,
        type: ALObjectType.Table,
        ranges: [{ from: 50100, to: 50149 }]
      });

      expect(response).toBeDefined();
      expect(response?.available).toBeDefined();
      expect(response?.hasConsumption).toBe(true);

      if (response?.available) {
        expect(typeof response.id).toBe('number');
        expect(response.id).toBeGreaterThanOrEqual(50100);
        expect(response.id).toBeLessThanOrEqual(50149);
      }
    });

    it('should get next ID per range', async () => {
      const response = await backendService.getNext({
        appId: TEST_APP_ID,
        authKey: TEST_AUTH_KEY,
        type: ALObjectType.Page,
        ranges: [
          { from: 50100, to: 50109 },
          { from: 50120, to: 50129 }
        ],
        perRange: true
      });

      expect(response).toBeDefined();

      if (response?.available && Array.isArray(response.id)) {
        expect(response.id.length).toBeGreaterThan(0);
        response.id.forEach((id: number, index: number) => {
          if (id > 0) {
            if (index === 0) {
              expect(id).toBeGreaterThanOrEqual(50100);
              expect(id).toBeLessThanOrEqual(50109);
            } else {
              expect(id).toBeGreaterThanOrEqual(50120);
              expect(id).toBeLessThanOrEqual(50129);
            }
          }
        });
      }
    });

    it('should handle unavailable ranges', async () => {
      const response = await backendService.getNext({
        appId: TEST_APP_ID,
        authKey: TEST_AUTH_KEY,
        type: ALObjectType.Table,
        ranges: [{ from: 1, to: 1 }] // Likely already consumed
      });

      expect(response).toBeDefined();
      expect(response?.available).toBeDefined();

      if (!response?.available) {
        expect(response?.id).toBe(0);
      }
    });
  });

  describe('syncIds', () => {
    it('should sync object IDs', async () => {
      const testIds: Partial<ObjectConsumptions> = {
        table: [50100, 50101],
        page: [50100],
        codeunit: [50100]
      };

      const success = await backendService.syncIds({
        appId: TEST_APP_ID,
        authKey: TEST_AUTH_KEY,
        ids: testIds as ObjectConsumptions,
        mode: 'merge'  // Explicit mode for clarity
      });

      expect(success).toBe(true);
    });

    it('should return false with invalid auth', async () => {
      const testIds: Partial<ObjectConsumptions> = {
        table: [50100]
      };

      const success = await backendService.syncIds({
        appId: TEST_APP_ID,
        authKey: 'invalid-key',
        ids: testIds as ObjectConsumptions
      });

      // syncIds returns false on error
      expect(success).toBe(false);
    });
  });

  describe('storeAssignment', () => {
    it('should store single assignment', async () => {
      const success = await backendService.storeAssignment(
        TEST_APP_ID,
        TEST_AUTH_KEY,
        'report',
        50100,
        'POST'
      );

      expect(success).toBe(true);
    });

    it('should return false with invalid auth', async () => {
      const success = await backendService.storeAssignment(
        TEST_APP_ID,
        'invalid-key',
        'report',
        50100,
        'POST'
      );

      // storeAssignment returns false on error
      expect(success).toBe(false);
    });
  });

  describe('authorizeApp', () => {
    it('should check authorization status', async () => {
      // Note: We can't test POST (authorize) as it would affect the test app
      // and we can't test DELETE (de-authorize) for the same reason
      // So we'll just verify the app is already authorized

      const consumptionResponse = await backendService.getConsumption({
        appId: TEST_APP_ID,
        authKey: TEST_AUTH_KEY
      });

      // If we get consumption data, the app is authorized
      expect(consumptionResponse).toBeDefined();
      expect(consumptionResponse?._total).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid object type', async () => {
      const response = await backendService.getNext({
        appId: TEST_APP_ID,
        authKey: TEST_AUTH_KEY,
        type: 'invalid-type' as ALObjectType,
        ranges: [{ from: 50100, to: 50149 }]
      });

      // getNext returns undefined on error
      expect(response).toBeUndefined();
    });

    it('should handle empty ranges', async () => {
      const response = await backendService.getNext({
        appId: TEST_APP_ID,
        authKey: TEST_AUTH_KEY,
        type: ALObjectType.Table,
        ranges: []
      });

      // May return undefined or an error response
      if (response) {
        expect(response.available).toBe(false);
      }
    });

    it('should handle missing auth key', async () => {
      const response = await backendService.getNext({
        appId: TEST_APP_ID,
        authKey: '',
        type: ALObjectType.Table,
        ranges: [{ from: 50100, to: 50149 }]
      });

      expect(response).toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should handle multiple rapid requests with delays', async () => {
      const promises = [];

      // Make 3 requests with delays to avoid rate limiting
      for (let i = 0; i < 3; i++) {
        promises.push(
          new Promise<{ status: string; value?: any; reason?: any }>(resolve => {
            setTimeout(async () => {
              try {
                const result = await backendService.checkApp(TEST_APP_ID);
                resolve({ status: 'fulfilled', value: result });
              } catch (err) {
                resolve({ status: 'rejected', reason: err });
              }
            }, i * 500); // Add 500ms delay between requests
          })
        );
      }

      const results = await Promise.all(promises);

      // At least some should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      successful.forEach((result: any) => {
        if (result.status === 'fulfilled') {
          expect(result.value.isManaged).toBeDefined();
        }
      });
    });
  });

  describe('Pool Management', () => {
    // Note: Pool operations modify state, so we'll test error cases
    it('should return null when joining non-existent pool', async () => {
      const response = await backendService.joinPool(
        TEST_APP_ID,
        TEST_AUTH_KEY,
        'non-existent-pool-id',
        'invalid-join-key'
      );

      expect(response).toBeNull();
    });

    it('should handle pool creation attempts', async () => {
      // Try to create a pool (may fail if app is already in a pool)
      const response = await backendService.createPool(
        TEST_APP_ID,
        TEST_AUTH_KEY,
        'Test Pool'
      );

      // Either succeeds with pool info or returns undefined on error
      if (response) {
        expect(response.poolId).toBeDefined();
        expect(response.joinKey).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('should respond quickly to checkApp', async () => {
      const startTime = Date.now();

      await backendService.checkApp(TEST_APP_ID);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should respond within 10 seconds
    });

    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();

      const promises = [
        backendService.checkApp(TEST_APP_ID),
        backendService.getConsumption({
          appId: TEST_APP_ID,
          authKey: TEST_AUTH_KEY
        }),
        backendService.getNext({
          appId: TEST_APP_ID,
          authKey: TEST_AUTH_KEY,
          type: ALObjectType.Enum,
          ranges: [{ from: 50100, to: 50149 }]
        })
      ];

      await Promise.allSettled(promises);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // All should complete within 5 seconds
    });
  });
});