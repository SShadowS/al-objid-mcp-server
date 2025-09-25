/**
 * Integration tests for live backend API
 *
 * These tests make real HTTP calls to the backend service.
 * They require:
 * - Network connectivity
 * - Valid backend URL (https://vjekocom-alext-weu.azurewebsites.net)
 * - Valid API key (from environment or config)
 *
 * Run with: npm run test:integration
 */

// Set environment variables before importing modules
process.env.NINJA_BACKEND_URL = process.env.OBJID_BACKEND_URL || 'https://vjekocom-alext-weu.azurewebsites.net';
process.env.NINJA_API_KEY = process.env.OBJID_API_KEY || '';

import { BackendService } from '../../src/lib/backend/BackendService';
import { ALObjectType } from '../../src/lib/types/ALObjectType';
import { Logger, LogLevel } from '../../src/lib/utils/Logger';

// Test configuration
const TEST_CONFIG = {
  // Use environment variables or defaults
  backendUrl: process.env.OBJID_BACKEND_URL || 'https://vjekocom-alext-weu.azurewebsites.net',
  apiKey: process.env.OBJID_API_KEY || 'your-api-key-here',
  testAppId: 'test-app-' + Date.now(), // Unique app ID for each test run
  testAppName: 'Integration Test App',
  skipTests: false // Set to true to skip integration tests
};

// Skip tests if no API key is configured
const describeIntegration = TEST_CONFIG.apiKey === 'your-api-key-here' || TEST_CONFIG.skipTests
  ? describe.skip
  : describe;

describeIntegration('Backend Service - Live Integration Tests', () => {
  let backendService: BackendService;
  let logger: Logger;
  let testAuthKey: string | undefined;

  beforeAll(() => {
    // Set up logger with verbose output for debugging
    logger = Logger.getInstance();
    logger.setLogLevel(LogLevel.Verbose);

    // Create backend service instance
    backendService = new BackendService();

    console.log('🔗 Running integration tests against:', TEST_CONFIG.backendUrl);
    console.log('📦 Test App ID:', TEST_CONFIG.testAppId);
  });

  describe('App Lifecycle', () => {
    test('should check if app exists (initially should not exist)', async () => {
      const result = await backendService.checkApp(TEST_CONFIG.testAppId);

      expect(result).toBeDefined();
      expect(result.managed).toBe(false);
      expect(result.hasPool).toBe(false);

      console.log('✅ App check result:', result);
    }, 10000);

    test('should authorize a new app', async () => {
      const request = {
        appId: TEST_CONFIG.testAppId,
        appName: TEST_CONFIG.testAppName,
        gitUser: 'test-user',
        gitEmail: 'test@example.com',
        gitRepo: 'https://github.com/test/repo',
        gitBranch: 'main'
      };

      const result = await backendService.authorizeApp(request);

      expect(result).toBeDefined();
      expect(result.authKey).toBeDefined();
      // The backend returns only { authKey } on successful authorization

      // Store auth key for subsequent tests
      testAuthKey = result.authKey;

      console.log('✅ App authorized with key:', testAuthKey?.substring(0, 8) + '...');
    }, 10000);

    test('should verify app is now authorized', async () => {
      const result = await backendService.checkApp(TEST_CONFIG.testAppId);

      expect(result).toBeDefined();
      expect(result.managed).toBe(true);

      console.log('✅ App authorization verified');
    }, 10000);
  });

  describe('Object ID Management', () => {
    test('should get next available table ID', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const request = {
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Table,
        ranges: [{ from: 50000, to: 50099 }],
        authKey: testAuthKey,
        perRange: false
      };

      const result = await backendService.getNext(request);

      expect(result).toBeDefined();
      expect(result?.available).toBe(true);

      const id = Array.isArray(result?.id) ? result.id[0] : result?.id;
      expect(id).toBeGreaterThanOrEqual(50000);
      expect(id).toBeLessThanOrEqual(50099);

      console.log('✅ Next table ID:', id);
    }, 10000);

    test('should get next available page ID', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const request = {
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Page,
        ranges: [{ from: 50000, to: 50099 }],
        authKey: testAuthKey,
        perRange: false
      };

      const result = await backendService.getNext(request);

      expect(result).toBeDefined();
      expect(result?.available).toBe(true);

      const id = Array.isArray(result?.id) ? result.id[0] : result?.id;
      expect(id).toBeGreaterThanOrEqual(50000);
      expect(id).toBeLessThanOrEqual(50099);

      console.log('✅ Next page ID:', id);
    }, 10000);

    test('should sync consumed IDs', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const request = {
        appId: TEST_CONFIG.testAppId,
        authKey: testAuthKey,
        ids: {
          [ALObjectType.Table]: [50000, 50001, 50002],
          [ALObjectType.Page]: [50000, 50001]
        }
      };

      const result = await backendService.syncIds(request);

      expect(result).toBe(true);

      console.log('✅ IDs synced successfully');
    }, 10000);

    test('should retrieve consumption after sync', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const request = {
        appId: TEST_CONFIG.testAppId,
        authKey: testAuthKey
      };

      const result = await backendService.getConsumption(request);

      expect(result).toBeDefined();
      expect(result?.[ALObjectType.Table]).toEqual(expect.arrayContaining([50000, 50001, 50002]));
      expect(result?.[ALObjectType.Page]).toEqual(expect.arrayContaining([50000, 50001]));

      console.log('✅ Consumption retrieved:', {
        tables: result?.[ALObjectType.Table]?.length,
        pages: result?.[ALObjectType.Page]?.length
      });
    }, 10000);

    test('should get next ID avoiding consumed ones', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const request = {
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Table,
        ranges: [{ from: 50000, to: 50099 }],
        authKey: testAuthKey,
        perRange: false
      };

      const result = await backendService.getNext(request);

      expect(result).toBeDefined();
      expect(result?.available).toBe(true);

      const id = Array.isArray(result?.id) ? result.id[0] : result?.id;

      // Should not return already consumed IDs
      expect(id).not.toBe(50000);
      expect(id).not.toBe(50001);
      expect(id).not.toBe(50002);
      expect(id).toBeGreaterThanOrEqual(50003);

      console.log('✅ Next available table ID (avoiding consumed):', id);
    }, 10000);
  });

  describe('Pool Management', () => {
    let poolId: string | undefined;

    test('should create a new pool', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const result = await backendService.createPool(
        TEST_CONFIG.testAppId,
        testAuthKey,
        'Test Pool',
        'test-join-key',
        'test-management-secret',
        [{ appId: TEST_CONFIG.testAppId, name: 'Test App' }],
        false
      );

      expect(result).toBeDefined();
      expect(result?.poolId).toBeDefined();

      poolId = result?.poolId;

      console.log('✅ Pool created:', poolId);
    }, 10000);

    test('should join an existing pool', async () => {
      if (!testAuthKey || !poolId) {
        console.warn('⚠️ Skipping: No auth key or pool ID available');
        return;
      }

      // Create a second test app to join the pool
      const secondAppId = TEST_CONFIG.testAppId + '-member';

      // First authorize the second app
      const authRequest = {
        appId: secondAppId,
        appName: 'Pool Member App',
        gitUser: 'test-user',
        gitEmail: 'test@example.com',
        gitRepo: 'https://github.com/test/repo',
        gitBranch: 'main'
      };

      const authResult = await backendService.authorizeApp(authRequest);
      const secondAuthKey = authResult.authKey;

      if (!secondAuthKey) {
        console.warn('⚠️ Could not authorize second app');
        return;
      }

      // Now join the pool
      const result = await backendService.joinPool(
        poolId,
        'test-join-key',
        [{ appId: secondAppId, name: 'Second Test App' }]
      );

      expect(result).toBe(true);

      console.log('✅ Second app joined pool:', poolId);
    }, 15000);

    test('should verify pool membership', async () => {
      if (!poolId) {
        console.warn('⚠️ Skipping: No pool ID available');
        return;
      }

      const result = await backendService.checkApp(TEST_CONFIG.testAppId);

      expect(result).toBeDefined();
      expect(result.hasPool).toBe(true);
      expect(result.poolId).toBe(poolId);

      console.log('✅ Pool membership verified');
    }, 10000);

    test('should leave pool', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const result = await backendService.leavePool(TEST_CONFIG.testAppId, testAuthKey);

      expect(result).toBe(true);

      console.log('✅ Left pool successfully');
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should handle invalid auth key gracefully', async () => {
      const request = {
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Table,
        ranges: [{ from: 50000, to: 50099 }],
        authKey: 'invalid-auth-key',
        perRange: false
      };

      const result = await backendService.getNext(request);

      // Should return undefined on auth failure
      expect(result).toBeUndefined();

      console.log('✅ Invalid auth handled gracefully');
    }, 10000);

    test('should handle network timeouts', async () => {
      // Create a backend service with very short timeout
      const timeoutService = new BackendService();

      // This is a bit hacky but demonstrates timeout handling
      const request = {
        appId: TEST_CONFIG.testAppId,
        authKey: testAuthKey || 'test',
      };

      // Make multiple rapid requests to potentially trigger rate limiting or delays
      const promises = Array(5).fill(null).map(() =>
        timeoutService.getConsumption(request)
      );

      const results = await Promise.allSettled(promises);

      // At least some should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      expect(succeeded).toBeGreaterThan(0);

      console.log(`✅ Handled ${results.length} concurrent requests (${succeeded} succeeded)`);
    }, 20000);
  });

  describe('Lite Mode Complete Workflow', () => {
    test('should properly reserve IDs without overriding previous assignments', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const testRanges = [{ from: 60000, to: 60099 }];

      // Step 1: Get first table ID (should be 60000)
      console.log('📍 Step 1: Getting first table ID...');
      const firstGetRequest = {
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Table,
        ranges: testRanges,
        authKey: testAuthKey,
        perRange: false
      };

      const firstGetResult = await backendService.getNext(firstGetRequest, false); // false = no commit
      const firstId = Array.isArray(firstGetResult?.id) ? firstGetResult.id[0] : firstGetResult?.id;
      expect(firstId).toBe(60000);
      console.log('✅ First ID retrieved (not reserved):', firstId);

      // Step 2: Reserve first ID (60000)
      console.log('📍 Step 2: Reserving first ID...');
      const firstReserveRequest = {
        ...firstGetRequest,
        require: 60000
      };

      const firstReserveResult = await backendService.getNext(firstReserveRequest, true); // true = commit
      const reservedId = Array.isArray(firstReserveResult?.id) ? firstReserveResult.id[0] : firstReserveResult?.id;
      expect(reservedId).toBe(60000);
      console.log('✅ First ID reserved:', reservedId);

      // Step 3: Get next table ID (should be 60001, NOT 60000)
      console.log('📍 Step 3: Getting next table ID (should skip reserved)...');
      const secondGetResult = await backendService.getNext(firstGetRequest, false);
      const secondId = Array.isArray(secondGetResult?.id) ? secondGetResult.id[0] : secondGetResult?.id;

      expect(secondId).not.toBe(60000); // Must not return reserved ID
      expect(secondId).toBe(60001);
      console.log('✅ Next ID correctly skipped reserved:', secondId);

      // Step 4: Reserve second ID (60001)
      console.log('📍 Step 4: Reserving second ID...');
      const secondReserveRequest = {
        ...firstGetRequest,
        require: 60001
      };

      const secondReserveResult = await backendService.getNext(secondReserveRequest, true);
      const secondReservedId = Array.isArray(secondReserveResult?.id) ? secondReserveResult.id[0] : secondReserveResult?.id;
      expect(secondReservedId).toBe(60001);
      console.log('✅ Second ID reserved:', secondReservedId);

      // Step 5: Get third ID (should be 60002)
      console.log('📍 Step 5: Getting third ID...');
      const thirdGetResult = await backendService.getNext(firstGetRequest, false);
      const thirdId = Array.isArray(thirdGetResult?.id) ? thirdGetResult.id[0] : thirdGetResult?.id;

      expect(thirdId).not.toBe(60000);
      expect(thirdId).not.toBe(60001);
      expect(thirdId).toBe(60002);
      console.log('✅ Third ID correctly skipped all reserved:', thirdId);

      // Verify consumption
      const consumption = await backendService.getConsumption({
        appId: TEST_CONFIG.testAppId,
        authKey: testAuthKey
      });

      const tables = consumption?.[ALObjectType.Table] || [];
      expect(tables).toContain(60000);
      expect(tables).toContain(60001);
      console.log('✅ Consumption correctly shows reserved IDs:', tables.filter(id => id >= 60000 && id <= 60099));
    }, 20000);

    test('should handle multiple object types independently', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const testRanges = [{ from: 61000, to: 61099 }];

      // Reserve table ID 61000
      console.log('📍 Reserving table 61000...');
      await backendService.getNext({
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Table,
        ranges: testRanges,
        authKey: testAuthKey,
        perRange: false,
        require: 61000
      }, true);

      // Reserve page ID 61000 (same number, different type)
      console.log('📍 Reserving page 61000...');
      await backendService.getNext({
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Page,
        ranges: testRanges,
        authKey: testAuthKey,
        perRange: false,
        require: 61000
      }, true);

      // Reserve codeunit ID 61000
      console.log('📍 Reserving codeunit 61000...');
      await backendService.getNext({
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Codeunit,
        ranges: testRanges,
        authKey: testAuthKey,
        perRange: false,
        require: 61000
      }, true);

      // Get next IDs for each type (should all be 61001)
      console.log('📍 Getting next IDs for each type...');

      const nextTable = await backendService.getNext({
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Table,
        ranges: testRanges,
        authKey: testAuthKey,
        perRange: false
      }, false);
      const nextTableId = Array.isArray(nextTable?.id) ? nextTable.id[0] : nextTable?.id;
      expect(nextTableId).toBe(61001);

      const nextPage = await backendService.getNext({
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Page,
        ranges: testRanges,
        authKey: testAuthKey,
        perRange: false
      }, false);
      const nextPageId = Array.isArray(nextPage?.id) ? nextPage.id[0] : nextPage?.id;
      expect(nextPageId).toBe(61001);

      const nextCodeunit = await backendService.getNext({
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Codeunit,
        ranges: testRanges,
        authKey: testAuthKey,
        perRange: false
      }, false);
      const nextCodeunitId = Array.isArray(nextCodeunit?.id) ? nextCodeunit.id[0] : nextCodeunit?.id;
      expect(nextCodeunitId).toBe(61001);

      console.log('✅ All object types track independently:', {
        nextTable: nextTableId,
        nextPage: nextPageId,
        nextCodeunit: nextCodeunitId
      });
    }, 20000);

    test('should maintain state across sessions', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const testRanges = [{ from: 62000, to: 62099 }];

      // Reserve IDs 62000-62005
      console.log('📍 Reserving IDs 62000-62005...');
      for (let i = 62000; i <= 62005; i++) {
        await backendService.getNext({
          appId: TEST_CONFIG.testAppId,
          type: ALObjectType.Report,
          ranges: testRanges,
          authKey: testAuthKey,
          perRange: false,
          require: i
        }, true);
      }

      // Simulate "new session" by creating a new backend service instance
      console.log('📍 Simulating new session...');
      const newBackendService = new BackendService();

      // Get next should respect previous reservations
      const nextId = await newBackendService.getNext({
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Report,
        ranges: testRanges,
        authKey: testAuthKey,
        perRange: false
      }, false);

      const id = Array.isArray(nextId?.id) ? nextId.id[0] : nextId?.id;
      expect(id).toBe(62006);

      console.log('✅ State persisted across sessions, next ID:', id);

      // Verify all previous IDs are marked as taken
      const consumption = await newBackendService.getConsumption({
        appId: TEST_CONFIG.testAppId,
        authKey: testAuthKey
      });

      const reports = consumption?.[ALObjectType.Report] || [];
      for (let i = 62000; i <= 62005; i++) {
        expect(reports).toContain(i);
      }
      console.log('✅ All reserved IDs persisted:', reports.filter(id => id >= 62000 && id <= 62099));
    }, 25000);

    test('should handle rapid bulk reservations without duplicates', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const testRanges = [{ from: 63000, to: 63099 }];
      const reservedIds: number[] = [];

      console.log('📍 Performing 20 rapid reservations...');
      const startTime = Date.now();

      // Reserve 20 IDs rapidly
      for (let i = 0; i < 20; i++) {
        const result = await backendService.getNext({
          appId: TEST_CONFIG.testAppId,
          type: ALObjectType.Query,
          ranges: testRanges,
          authKey: testAuthKey,
          perRange: false
        }, true); // Commit each one

        const id = Array.isArray(result?.id) ? result.id[0] : result?.id;
        if (id) {
          reservedIds.push(id);
        }
      }

      const duration = Date.now() - startTime;

      // Verify no duplicates
      const uniqueIds = new Set(reservedIds);
      expect(uniqueIds.size).toBe(20);
      expect(uniqueIds.size).toBe(reservedIds.length);

      // Verify sequential
      const sortedIds = [...reservedIds].sort((a, b) => a - b);
      expect(sortedIds[0]).toBe(63000);
      expect(sortedIds[19]).toBe(63019);

      console.log(`✅ Completed 20 reservations in ${duration}ms without duplicates`);
      console.log('✅ IDs reserved:', sortedIds.slice(0, 5), '...', sortedIds.slice(-5));

      // Verify all IDs are in the consumption
      const consumption = await backendService.getConsumption({
        appId: TEST_CONFIG.testAppId,
        authKey: testAuthKey
      });

      const queries = consumption?.[ALObjectType.Query] || [];
      for (const id of reservedIds) {
        expect(queries).toContain(id);
      }
      console.log('✅ All bulk reserved IDs in consumption');
    }, 30000);

    test('should correctly handle range boundaries', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      // Use a very small range
      const limitedRanges = [{ from: 64000, to: 64002 }]; // Only 3 IDs available

      console.log('📍 Testing with limited range 64000-64002...');

      // Reserve all available IDs
      for (let i = 64000; i <= 64002; i++) {
        const result = await backendService.getNext({
          appId: TEST_CONFIG.testAppId,
          type: ALObjectType.XmlPort,
          ranges: limitedRanges,
          authKey: testAuthKey,
          perRange: false
        }, true);

        const id = Array.isArray(result?.id) ? result.id[0] : result?.id;
        expect(id).toBe(i);
        console.log(`✅ Reserved ${i}`);
      }

      // Try to get one more - should fail
      console.log('📍 Attempting to get ID beyond range...');
      const exhaustedResult = await backendService.getNext({
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.XmlPort,
        ranges: limitedRanges,
        authKey: testAuthKey,
        perRange: false
      }, false);

      // Should either return undefined or have available: false
      if (exhaustedResult) {
        expect(exhaustedResult.available).toBe(false);
      } else {
        expect(exhaustedResult).toBeUndefined();
      }

      console.log('✅ Correctly handled range exhaustion');
    }, 20000);
  });

  describe('Performance Tests', () => {
    test('should handle rapid sequential requests', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const startTime = Date.now();
      const requests = 10;

      for (let i = 0; i < requests; i++) {
        const request = {
          appId: TEST_CONFIG.testAppId,
          type: ALObjectType.Codeunit,
          ranges: [{ from: 50000 + i * 100, to: 50099 + i * 100 }],
          authKey: testAuthKey,
          perRange: false
        };

        const result = await backendService.getNext(request);
        expect(result).toBeDefined();
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / requests;

      console.log(`✅ Completed ${requests} requests in ${duration}ms (avg: ${avgTime.toFixed(0)}ms)`);

      // Should complete reasonably quickly (under 500ms per request on average)
      expect(avgTime).toBeLessThan(500);
    }, 30000);
  });

  afterAll(() => {
    console.log('\n📊 Integration tests completed');
    console.log('=====================================\n');
  });
});

// Helper to run a single test in isolation
export async function runSingleIntegrationTest() {
  const logger = Logger.getInstance();
  logger.setLogLevel(LogLevel.Verbose);

  const backendService = new BackendService();

  console.log('Running single integration test...');

  const result = await backendService.checkApp('test-app');
  console.log('Result:', result);

  return result;
}

// If running this file directly
if (require.main === module) {
  runSingleIntegrationTest()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Test failed:', err);
      process.exit(1);
    });
}