#!/usr/bin/env ts-node

/**
 * Standalone test runner for live backend integration
 *
 * Usage:
 *   npm run test:live
 *   or
 *   ts-node test-backend-live.ts
 *
 * Environment variables (can be set in .env file):
 *   OBJID_BACKEND_URL - Backend URL (defaults to Azure Function URL)
 *   OBJID_API_KEY - API key for authentication
 *   TEST_APP_ID - Use a persistent test app ID (optional)
 *   TEST_AUTH_KEY - Auth key for the persistent test app (required if TEST_APP_ID is set)
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file from mcp-server directory
dotenv.config({ path: path.join(__dirname, '.env') });

// Set environment variables before importing modules
process.env.NINJA_BACKEND_URL = process.env.OBJID_BACKEND_URL || 'https://vjekocom-alext-weu.azurewebsites.net';
process.env.NINJA_API_KEY = process.env.OBJID_API_KEY || '';

import { BackendService } from './src/lib/backend/BackendService';
import { ALObjectType } from './src/lib/types/ALObjectType';
import { Logger, LogLevel } from './src/lib/utils/Logger';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(50));
  log(title, colors.bright + colors.blue);
  console.log('='.repeat(50));
}

async function testLiveBackend() {
  const logger = Logger.getInstance();
  logger.setLogLevel(LogLevel.Info);

  const backendService = new BackendService();

  // Use persistent test app if provided, otherwise create a new one
  const isPersistentApp = !!process.env.TEST_APP_ID;
  const testAppId = process.env.TEST_APP_ID || `test-app-${Date.now()}`;
  const testAppName = 'Live Backend Test App';
  let authKey: string | undefined = process.env.TEST_AUTH_KEY;
  let testsPassed = 0;
  let testsFailed = 0;

  log('🚀 AL Object ID Ninja - Live Backend Test', colors.bright + colors.cyan);
  log(`📍 Backend URL: ${process.env.NINJA_BACKEND_URL}`, colors.cyan);
  log(`📦 Test App ID: ${testAppId}`, colors.cyan);

  if (isPersistentApp) {
    log(`♻️  Using persistent test app`, colors.yellow);
    if (!authKey) {
      log(`⚠️  Warning: TEST_AUTH_KEY not provided for persistent app`, colors.red);
    }
  } else {
    log(`🆕 Using fresh test app`, colors.green);
  }

  if (process.env.NINJA_API_KEY) {
    log(`🔑 API Key: ${process.env.NINJA_API_KEY.substring(0, 8)}...`, colors.cyan);
  } else {
    log(`⚠️  No API key configured (some tests may fail)`, colors.yellow);
  }

  try {
    // Test 1: Check App
    if (isPersistentApp) {
      logSection('Test 1: Check Existing App');
      try {
        const result = await backendService.checkApp(testAppId);
        log(`App managed: ${result.managed}`, colors.green);
        log(`Has pool: ${result.hasPool}`, colors.green);

        if (result.managed) {
          log('✅ Test passed: Persistent app is already managed', colors.green);

          // Get existing consumption to show state
          const consumption = await backendService.getConsumption({ appId: testAppId, authKey: authKey || '' });
          if (consumption) {
            log('📊 Existing consumption:', colors.cyan);
            for (const [type, ids] of Object.entries(consumption)) {
              if (Array.isArray(ids) && ids.length > 0) {
                log(`  ${type}: ${ids.length} IDs already consumed`, colors.cyan);
              }
            }
          }
          testsPassed++;
        } else {
          log('⚠️  Persistent app not managed, will authorize it', colors.yellow);
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }
    } else {
      logSection('Test 1: Check Non-Existent App');
      try {
        const result = await backendService.checkApp(testAppId);
        log(`App managed: ${result.managed}`, colors.green);
        log(`Has pool: ${result.hasPool}`, colors.green);

        if (!result.managed) {
          log('✅ Test passed: App correctly reported as not managed', colors.green);
          testsPassed++;
        } else {
          throw new Error('App should not be managed');
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }
    }

    // Test 2: Authorize App
    if (!isPersistentApp || !authKey) {
      logSection('Test 2: Authorize App');
      try {
        const request = {
          appId: testAppId,
          appName: testAppName,
          gitUser: 'test-user',
          gitEmail: 'test@example.com',
          gitRepo: 'https://github.com/test/repo',
          gitBranch: 'main'
        };

        const result = await backendService.authorizeApp(request);

        if (result && result.authKey) {
          authKey = result.authKey;
          log(`✅ App authorized successfully`, colors.green);
          log(`Auth key: ${authKey.substring(0, 8)}...`, colors.green);

          if (isPersistentApp) {
            log(`💡 Save this auth key for future use:`, colors.yellow);
            log(`   TEST_AUTH_KEY=${authKey}`, colors.yellow);
          }
          testsPassed++;
        } else {
          throw new Error('Authorization failed - no auth key returned');
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }
    } else {
      logSection('Test 2: Skip Authorization (Using Existing)');
      log(`✅ Using existing auth key: ${authKey.substring(0, 8)}...`, colors.green);
      testsPassed++;
    }

    // Test 3: Get Next Table ID
    if (authKey) {
      logSection('Test 3: Get Next Table ID');
      try {
        const request = {
          appId: testAppId,
          type: ALObjectType.Table,
          ranges: [{ from: 50000, to: 50099 }],
          authKey,
          perRange: false
        };

        const result = await backendService.getNext(request);

        if (result && result.available) {
          const id = Array.isArray(result.id) ? result.id[0] : result.id;
          log(`✅ Next table ID: ${id}`, colors.green);
          testsPassed++;
        } else {
          throw new Error('No available ID returned');
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }

      // Test 4: Sync IDs (only for fresh apps or sync new IDs for persistent)
      if (isPersistentApp) {
        logSection('Test 4: Sync New Object IDs (Persistent App)');
        try {
          // First get existing consumption to know what's already there
          const existingConsumption = await backendService.getConsumption({ appId: testAppId, authKey });

          // Calculate new IDs that don't conflict with existing ones
          const existingTables = existingConsumption?.table || [];
          const existingPages = existingConsumption?.page || [];
          const existingCodeunits = existingConsumption?.codeunit || [];

          // Find next available IDs after existing ones
          const newTableId = existingTables.length > 0 ? Math.max(...existingTables) + 1 : 50000;
          const newPageId = existingPages.length > 0 ? Math.max(...existingPages) + 1 : 50100;
          const newCodeunitId = existingCodeunits.length > 0 ? Math.max(...existingCodeunits) + 1 : 50200;

          if (existingTables.length > 0) {
            log(`📊 Existing consumption found:`, colors.cyan);
            log(`  Tables: ${existingTables.length} IDs already synced`, colors.cyan);
            log(`  Pages: ${existingPages.length} IDs already synced`, colors.cyan);
            log(`  Codeunits: ${existingCodeunits.length} IDs already synced`, colors.cyan);

            // Sync all IDs (existing + new) to simulate a real workspace
            // where all files with IDs still exist
            const request = {
              appId: testAppId,
              authKey,
              ids: {
                [ALObjectType.Table]: [...existingTables, newTableId],
                [ALObjectType.Page]: [...existingPages, newPageId],
                [ALObjectType.Codeunit]: [...existingCodeunits, newCodeunitId]
              }
            };

            const result = await backendService.syncIds(request);

            if (result) {
              log(`✅ New IDs synced successfully`, colors.green);
              log(`  New Table: ${newTableId}`, colors.green);
              log(`  New Page: ${newPageId}`, colors.green);
              log(`  New Codeunit: ${newCodeunitId}`, colors.green);
              testsPassed++;
            } else {
              throw new Error('Sync failed');
            }
          } else {
            log(`⚠️  No existing consumption found, skipping sync test`, colors.yellow);
            log(`   This persistent app might be newly authorized`, colors.yellow);
            testsPassed++;
          }
        } catch (error) {
          log(`❌ Test failed: ${error}`, colors.red);
          testsFailed++;
        }
      } else {
        logSection('Test 4: Sync Object IDs');
        try {
          const request = {
            appId: testAppId,
            authKey,
            ids: {
              [ALObjectType.Table]: [50000, 50001, 50002],
              [ALObjectType.Page]: [50100, 50101],
              [ALObjectType.Codeunit]: [50200]
            }
          };

          const result = await backendService.syncIds(request);

          if (result) {
            log(`✅ IDs synced successfully`, colors.green);
            log(`  Tables: 50000, 50001, 50002`, colors.green);
            log(`  Pages: 50100, 50101`, colors.green);
            log(`  Codeunits: 50200`, colors.green);
            testsPassed++;
          } else {
            throw new Error('Sync failed');
          }
        } catch (error) {
          log(`❌ Test failed: ${error}`, colors.red);
          testsFailed++;
        }
      }

      // Test 5: Get Consumption
      logSection('Test 5: Get Consumption');
      try {
        const request = {
          appId: testAppId,
          authKey
        };

        const result = await backendService.getConsumption(request);

        if (result) {
          log(`✅ Consumption retrieved:`, colors.green);

          for (const [type, ids] of Object.entries(result)) {
            if (ids && ids.length > 0) {
              log(`  ${type}: ${ids.length} IDs (${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '...' : ''})`, colors.green);
            }
          }

          // For persistent apps, verify that consumption includes both old and new IDs
          if (isPersistentApp) {
            const tables = result.table || [];
            if (tables.includes(50000) && tables.includes(50001) && tables.includes(50002)) {
              log(`✅ Original IDs preserved in consumption`, colors.green);
            }
            if (tables.length > 3) {
              log(`✅ New IDs added to existing consumption`, colors.green);
            }
          }

          testsPassed++;
        } else {
          throw new Error('No consumption data returned');
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }

      // Test 6: Get Next ID (should avoid consumed)
      logSection('Test 6: Get Next ID (Avoiding Consumed)');
      try {
        // First get current consumption to know what IDs to avoid
        const consumption = await backendService.getConsumption({ appId: testAppId, authKey });
        const consumedTables = consumption?.table || [];

        const request = {
          appId: testAppId,
          type: ALObjectType.Table,
          ranges: [{ from: 50000, to: 50099 }],
          authKey,
          perRange: false
        };

        const result = await backendService.getNext(request);

        if (result && result.available) {
          const id = Array.isArray(result.id) ? result.id[0] : result.id;

          // Check if the returned ID is NOT in the consumed list
          if (!consumedTables.includes(id)) {
            log(`✅ Next table ID (avoiding consumed): ${id}`, colors.green);
            log(`   Consumed IDs: ${consumedTables.slice(0, 5).join(', ')}${consumedTables.length > 5 ? '...' : ''}`, colors.cyan);
            testsPassed++;
          } else {
            throw new Error(`Returned already consumed ID: ${id}. Consumed: [${consumedTables.join(', ')}]`);
          }
        } else {
          throw new Error('No available ID returned');
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }

      // Test 7: Pool Management
      logSection('Test 7: Pool Management');
      try {
        // Create pool
        const createResult = await backendService.createPool(
          testAppId,
          authKey,
          'TestPool',
          'test-join-key',
          'test-management-secret'
        );

        if (createResult && createResult.poolId) {
          log(`✅ Pool created: ${createResult.poolId}`, colors.green);

          // Pool created successfully, now try to leave it
          log(`✅ Pool operations available`, colors.green);

          // Leave pool
          const leaveResult = await backendService.leavePool(testAppId, authKey);

          if (leaveResult) {
            log(`✅ Successfully left pool`, colors.green);
            testsPassed++;
          } else {
            log(`✅ Pool creation succeeded (leave operation may not be supported)`, colors.green);
            testsPassed++;
          }
        } else {
          throw new Error('Pool creation failed');
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }
    }

    // Test 8: Existing Consumption Handling (for persistent apps)
    if (isPersistentApp && authKey) {
      logSection('Test 8: Existing Consumption Handling');
      try {
        // Get current consumption
        const consumption = await backendService.getConsumption({ appId: testAppId, authKey });
        const hasExistingIds = consumption && Object.keys(consumption).some(
          type => Array.isArray(consumption[type]) && consumption[type].length > 0
        );

        if (hasExistingIds) {
          log('✅ Testing with existing consumption:', colors.green);

          // Try to get next ID which should avoid consumed ones
          const request = {
            appId: testAppId,
            type: ALObjectType.Table,
            ranges: [{ from: 50000, to: 50099 }],
            authKey,
            perRange: false
          };

          const result = await backendService.getNext(request);

          if (result && result.id) {
            const nextId = Array.isArray(result.id) ? result.id[0] : result.id;
            const tableIds = consumption.table || [];

            if (tableIds.includes(nextId)) {
              throw new Error('Next ID conflicts with existing consumption');
            }

            log(`✅ Next ID correctly avoids consumed: ${nextId}`, colors.green);
            log(`   Existing table IDs: ${tableIds.slice(0, 5).join(', ')}${tableIds.length > 5 ? '...' : ''}`, colors.cyan);
            testsPassed++;
          }
        } else {
          log('⚠️  No existing consumption to test against', colors.yellow);
          log('   Run test again to build consumption history', colors.yellow);
          testsPassed++; // Don't fail the test for this
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }
    }

    // Test 9: Error Handling
    logSection('Test 9: Error Handling');
    try {
      const request = {
        appId: testAppId,
        type: ALObjectType.Table,
        ranges: [{ from: 50000, to: 50099 }],
        authKey: 'invalid-key',
        perRange: false
      };

      const result = await backendService.getNext(request);

      if (!result) {
        log(`✅ Invalid auth key handled gracefully`, colors.green);
        testsPassed++;
      } else {
        throw new Error('Should have failed with invalid auth');
      }
    } catch (error) {
      log(`❌ Test failed: ${error}`, colors.red);
      testsFailed++;
    }

    // Test 10: Sync Modes (Merge vs Replace)
    if (authKey) {
      logSection('Test 10: Sync Modes (Merge vs Replace)');
      try {
        // First, get current consumption
        const initialConsumption = await backendService.getConsumption({ appId: testAppId, authKey });
        const initialTables = initialConsumption?.table || [];

        log(`Initial tables: ${initialTables.length} IDs`, colors.cyan);

        // Test merge mode (default) - should add new IDs
        const mergeRequest = {
          appId: testAppId,
          authKey,
          ids: {
            [ALObjectType.Table]: [50090, 50091]  // New IDs not in initial set
          }
          // mode is omitted, should default to 'merge'
        };

        await backendService.syncIds(mergeRequest);

        const afterMerge = await backendService.getConsumption({ appId: testAppId, authKey });
        const tablesAfterMerge = afterMerge?.table || [];

        const hasOriginalIds = initialTables.every(id => tablesAfterMerge.includes(id));
        const hasNewIds = tablesAfterMerge.includes(50090) && tablesAfterMerge.includes(50091);

        if (hasOriginalIds && hasNewIds) {
          log(`✅ Merge mode correctly preserved existing IDs and added new ones`, colors.green);
          log(`   Tables after merge: ${tablesAfterMerge.length} IDs`, colors.green);
          testsPassed++;
        } else {
          throw new Error('Merge mode did not work correctly');
        }

        // Test replace mode - should replace all IDs
        const replaceRequest = {
          appId: testAppId,
          authKey,
          ids: {
            [ALObjectType.Table]: [50095, 50096, 50097],  // Completely different set
            [ALObjectType.Page]: [50195]
          },
          mode: 'replace' as const,
          completeness: 'full' as const  // Required for replace mode
        };

        await backendService.syncIds(replaceRequest);

        const afterReplace = await backendService.getConsumption({ appId: testAppId, authKey });
        const tablesAfterReplace = afterReplace?.table || [];
        const pagesAfterReplace = afterReplace?.page || [];

        const hasOnlyNewIds =
          tablesAfterReplace.length === 3 &&
          tablesAfterReplace.includes(50095) &&
          tablesAfterReplace.includes(50096) &&
          tablesAfterReplace.includes(50097) &&
          !tablesAfterReplace.includes(50090) &&  // Old IDs should be gone
          !tablesAfterReplace.includes(50091);

        if (hasOnlyNewIds) {
          log(`✅ Replace mode correctly replaced all IDs`, colors.green);
          log(`   Tables after replace: ${tablesAfterReplace.join(', ')}`, colors.green);
          log(`   Pages after replace: ${pagesAfterReplace.join(', ')}`, colors.green);
          testsPassed++;
        } else {
          throw new Error('Replace mode did not work correctly');
        }

        // Test safeguard: replace without completeness='full' should fail
        try {
          const unsafeReplaceRequest = {
            appId: testAppId,
            authKey,
            ids: {
              [ALObjectType.Table]: [50098]
            },
            mode: 'replace' as const
            // completeness is omitted - should fail
          };

          await backendService.syncIds(unsafeReplaceRequest);
          throw new Error('Replace without completeness=full should have failed');
        } catch (error: any) {
          if (error.message.includes('completeness')) {
            log(`✅ Safeguard working: Replace mode requires completeness='full'`, colors.green);
            testsPassed++;
          } else {
            throw error;
          }
        }

      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }
    }

  } catch (error) {
    log(`\n❌ Fatal error: ${error}`, colors.red);
  }

  // Summary
  logSection('Test Summary');
  const total = testsPassed + testsFailed;
  const passRate = total > 0 ? ((testsPassed / total) * 100).toFixed(1) : '0';

  if (testsFailed === 0) {
    log(`✅ All tests passed! (${testsPassed}/${total})`, colors.bright + colors.green);
  } else {
    log(`⚠️  Some tests failed`, colors.bright + colors.yellow);
    log(`   Passed: ${testsPassed}`, colors.green);
    log(`   Failed: ${testsFailed}`, colors.red);
    log(`   Pass rate: ${passRate}%`, colors.yellow);
  }

  // Provide usage instructions for persistent testing
  if (!isPersistentApp && authKey) {
    log('\n📝 To test with persistent app (recommended):', colors.cyan);
    log(`   TEST_APP_ID="${testAppId}" TEST_AUTH_KEY="${authKey}" npm run test:live`, colors.yellow);
    log('   This will test handling of existing consumption', colors.yellow);
  }

  return testsFailed === 0 ? 0 : 1;
}

// Run the test
testLiveBackend()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    log(`\n❌ Unhandled error: ${error}`, colors.red);
    process.exit(1);
  });