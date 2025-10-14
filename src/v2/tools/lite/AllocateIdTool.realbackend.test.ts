/**
 * Real Backend Integration Test for AllocateIdTool
 *
 * Tests ID reservation logic against a REAL backend running at http://localhost:7071
 * NO MOCKING - This tests actual backend behavior
 */

import { AllocateIdTool } from './AllocateIdTool';
import { ConfigManager } from '../../lib/config/ConfigManager';
import { BackendService } from '../../lib/backend/BackendService';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// This test requires the backend to be running at http://localhost:7071
const BACKEND_URL = 'http://localhost:7071';
const TEST_TIMEOUT = 30000; // 30 seconds for real backend calls

describe('AllocateIdTool - Real Backend Integration', () => {
  let tool: AllocateIdTool;
  let testAppPath: string;
  let backend: BackendService;
  let testAppId: string;

  beforeAll(async () => {
    // Create a temporary test directory
    testAppPath = path.join(os.tmpdir(), `mcp-test-app-${Date.now()}`);
    await fs.mkdir(testAppPath, { recursive: true });

    // Create app.json with a unique test app ID
    testAppId = `test-app-${Date.now()}`;
    const appJson = {
      id: testAppId,
      name: 'Test App',
      publisher: 'Test Publisher',
      version: '1.0.0.0'
    };
    await fs.writeFile(
      path.join(testAppPath, 'app.json'),
      JSON.stringify(appJson, null, 2)
    );

    // Create .objidconfig with test ranges
    const objidConfig = {
      idRanges: {
        table: [{ from: 50000, to: 50099 }],
        page: [{ from: 60000, to: 60099 }]
      }
    };
    await fs.writeFile(
      path.join(testAppPath, '.objidconfig'),
      JSON.stringify(objidConfig, null, 2)
    );

    // Initialize backend service pointing to local test backend
    backend = new BackendService(BACKEND_URL);

    // Create tool instance (it will use environment config)
    // We need to temporarily override the backend URL
    process.env.BACKEND_URL = BACKEND_URL;
    tool = new AllocateIdTool();
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testAppPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
  });

  describe('ID Reservation Persistence', () => {
    it(
      'should reserve different IDs on consecutive reserve calls',
      async () => {
        // Step 1: Get current consumption (baseline)
        console.log('Step 1: Getting initial consumption...');
        const initialConsumption = await backend.getConsumption({
          appPath: testAppPath
        });
        console.log('Initial consumption:', initialConsumption);

        const initialTableIds = initialConsumption?.table || [];
        console.log('Initial table IDs:', initialTableIds);

        // Add small delay to avoid backend concurrency issues
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 2: Reserve first ID
        console.log('\nStep 2: Reserving first table ID...');
        const firstReservation = await tool.execute({
          mode: 'reserve',
          appPath: testAppPath,
          object_type: 'table',
          count: 1,
          dry_run: false
        });

        console.log('First reservation result:', firstReservation);
        expect(firstReservation.mode).toBe('reserve');
        expect(firstReservation.reserved).toBe(true);
        expect(firstReservation.ids).toHaveLength(1);
        const firstId = firstReservation.ids[0];
        expect(firstId).toBeGreaterThanOrEqual(50000);
        expect(firstId).toBeLessThanOrEqual(50099);

        // Add delay to let backend settle
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 3: Verify first ID is reserved in backend
        console.log('\nStep 3: Verifying first ID is stored in backend...');
        const afterFirstConsumption = await backend.getConsumption({
          appPath: testAppPath
        });
        console.log('Consumption after first reservation:', afterFirstConsumption);

        const afterFirstTableIds = afterFirstConsumption?.table || [];
        console.log('Table IDs after first reservation:', afterFirstTableIds);
        expect(afterFirstTableIds).toContain(firstId);

        // Add delay before second reservation
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 4: Reserve second ID
        console.log('\nStep 4: Reserving second table ID...');
        const secondReservation = await tool.execute({
          mode: 'reserve',
          appPath: testAppPath,
          object_type: 'table',
          count: 1,
          dry_run: false
        });

        console.log('Second reservation result:', secondReservation);
        expect(secondReservation.mode).toBe('reserve');
        expect(secondReservation.reserved).toBe(true);
        expect(secondReservation.ids).toHaveLength(1);
        const secondId = secondReservation.ids[0];
        expect(secondId).toBeGreaterThanOrEqual(50000);
        expect(secondId).toBeLessThanOrEqual(50099);

        // Step 5: THE CRITICAL TEST - Second ID must be different from first!
        console.log('\nStep 5: Verifying second ID is different from first...');
        console.log(`First ID: ${firstId}, Second ID: ${secondId}`);
        expect(secondId).not.toBe(firstId);
        expect(secondId).toBe(firstId + 1); // Should be sequential

        // Step 6: Verify both IDs are now in backend
        console.log('\nStep 6: Verifying both IDs are stored in backend...');
        const finalConsumption = await backend.getConsumption({
          appPath: testAppPath
        });
        console.log('Final consumption:', finalConsumption);

        const finalTableIds = finalConsumption?.table || [];
        console.log('Final table IDs:', finalTableIds);
        expect(finalTableIds).toContain(firstId);
        expect(finalTableIds).toContain(secondId);
        expect(finalTableIds.length).toBeGreaterThanOrEqual(2);
      },
      TEST_TIMEOUT
    );

    it(
      'should reserve multiple IDs in a single call',
      async () => {
        console.log('\nTesting multiple ID reservation in single call...');

        // Add delay to let backend settle from previous test
        await new Promise(resolve => setTimeout(resolve, 2000));

        const reservation = await tool.execute({
          mode: 'reserve',
          appPath: testAppPath,
          object_type: 'page',
          count: 3,
          dry_run: false
        });

        console.log('Multiple ID reservation result:', reservation);
        expect(reservation.mode).toBe('reserve');
        expect(reservation.reserved).toBe(true);
        expect(reservation.ids).toHaveLength(3);

        // All IDs should be unique
        const uniqueIds = new Set(reservation.ids);
        expect(uniqueIds.size).toBe(3);

        // All IDs should be in the correct range
        reservation.ids.forEach(id => {
          expect(id).toBeGreaterThanOrEqual(60000);
          expect(id).toBeLessThanOrEqual(60099);
        });

        // Verify all IDs are stored in backend
        const consumption = await backend.getConsumption({
          appPath: testAppPath
        });
        console.log('Consumption after multiple reservation:', consumption);

        const pageIds = consumption?.page || [];
        reservation.ids.forEach(id => {
          expect(pageIds).toContain(id);
        });
      },
      TEST_TIMEOUT
    );
  });
});
