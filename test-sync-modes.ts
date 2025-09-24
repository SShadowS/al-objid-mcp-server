#!/usr/bin/env ts-node

/**
 * Test script to verify sync modes functionality (UPDATE/MERGE vs REPLACE)
 * Usage: npx ts-node test-sync-modes.ts <app-folder-path> [merge|replace]
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { BackendService } from './src/lib/backend/BackendService';

interface ALApp {
  name: string;
  appId: string;
  version: string;
  path: string;
  authKey?: string;
}

async function findAppJson(appPath: string): Promise<any> {
  const appJsonPath = path.join(appPath, 'app.json');
  if (!fs.existsSync(appJsonPath)) {
    throw new Error(`app.json not found in ${appPath}`);
  }

  const content = fs.readFileSync(appJsonPath, 'utf8');
  return JSON.parse(content);
}

async function findObjIdConfig(appPath: string): Promise<any> {
  const objIdConfigPath = path.join(appPath, '.objidconfig');
  if (!fs.existsSync(objIdConfigPath)) {
    return null;
  }

  const content = fs.readFileSync(objIdConfigPath, 'utf8');
  // Remove comments for JSON parsing
  const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return JSON.parse(cleanContent);
}

async function getPoolIdFromAppIdIfAvailable(appId: string, appPath: string): Promise<string> {
  const objIdConfig = await findObjIdConfig(appPath);
  if (!objIdConfig || !objIdConfig.appPoolId) {
    return appId;
  }

  const { appPoolId } = objIdConfig;
  if (appPoolId.length !== 64 || !/[0-9A-Fa-f]{6}/g.test(appPoolId)) {
    console.log(`⚠️  Invalid appPoolId format: ${appPoolId}`);
    return appId;
  }

  return appPoolId;
}

function getSha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function findAuthKey(appPath: string): Promise<string | undefined> {
  // Check .bclicense file
  const bcLicensePath = path.join(appPath, '.bclicense');
  if (fs.existsSync(bcLicensePath)) {
    const content = fs.readFileSync(bcLicensePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.startsWith('authKey=')) {
        return line.substring('authKey='.length).trim();
      }
    }
  }

  // Check .objidconfig for authKey
  const objIdConfig = await findObjIdConfig(appPath);
  if (objIdConfig && objIdConfig.authKey) {
    return objIdConfig.authKey;
  }

  return undefined;
}

async function loadAppFromFolder(appPath: string): Promise<ALApp> {
  const absolutePath = path.resolve(appPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`App folder does not exist: ${absolutePath}`);
  }

  const appJson = await findAppJson(absolutePath);
  const authKey = await findAuthKey(absolutePath);

  // Generate app ID from the app.json id field (GUID) - matching VS Code extension
  const appId = getSha256(appJson.id);

  const app: ALApp = {
    name: appJson.name,
    appId,
    version: appJson.version,
    path: absolutePath,
    authKey
  };

  return app;
}

async function testSyncModes(appPath: string, syncMode: 'merge' | 'replace' = 'merge'): Promise<void> {
  console.log('🚀 AL Object ID Ninja - Sync Modes Test');
  console.log('='.repeat(60));

  try {
    // Load app information
    console.log(`📂 Loading app from: ${appPath}`);
    const app = await loadAppFromFolder(appPath);

    console.log(`📱 App: ${app.name} v${app.version}`);
    console.log(`🆔 App ID: ${app.appId}`);
    console.log(`🔐 Auth Key: ${app.authKey ? app.authKey.substring(0, 8) + '...' : 'NOT FOUND'}`);
    console.log(`🔄 Sync Mode: ${syncMode.toUpperCase()}`);
    console.log();

    if (!app.authKey) {
      console.log('❌ No auth key found. Please ensure the app is authorized with Object ID Ninja.');
      console.log('   Auth key should be in .bclicense file as: authKey=your-key-here');
      return;
    }

    // Initialize backend service
    const backendService = new BackendService();

    // Get pool ID if available (matches VSCode extension behavior)
    const appId = await getPoolIdFromAppIdIfAvailable(app.appId, app.path);
    console.log(`🎯 Using App ID: ${appId === app.appId ? 'Raw App ID' : 'Pool ID'} (${appId.substring(0, 8)}...)`);

    // Create test data to sync
    const testData = {
      table: [50001, 50002],
      page: [60001],
      codeunit: [70001]
    };

    console.log('📤 Test sync data:');
    for (const [objectType, ids] of Object.entries(testData)) {
      console.log(`   ${objectType}: ${ids.join(', ')}`);
    }
    console.log();

    console.log(`🌐 Testing ${syncMode.toUpperCase()} sync mode...`);

    // Sync object IDs with specified mode
    const request = {
      appId,
      authKey: app.authKey,
      ids: testData,
      merge: syncMode === 'merge' // true for UPDATE/MERGE (PATCH), false for REPLACE (POST)
    };

    console.log(`🔄 HTTP Method: ${syncMode === 'merge' ? 'PATCH' : 'POST'}`);

    const result = await backendService.syncIds(request);

    if (!result) {
      console.log('❌ Failed to sync object IDs');
      console.log('   Possible causes:');
      console.log('   - Invalid auth key');
      console.log('   - App not authorized');
      console.log('   - Network connectivity issues');
      console.log('   - Backend API error');
      return;
    }

    console.log('✅ Object IDs synced successfully!');
    console.log();

    // Fetch updated consumption report to verify sync
    console.log('📊 Fetching updated consumption report...');
    const consumptionRequest = {
      appId,
      authKey: app.authKey
    };

    const consumption = await backendService.getConsumption(consumptionRequest);

    if (!consumption) {
      console.log('⚠️  Could not fetch consumption report to verify sync');
      return;
    }

    console.log('📋 Updated Object ID Consumption:');
    console.log('-'.repeat(40));

    let totalIds = 0;
    const objectTypes = Object.keys(consumption).sort();

    if (objectTypes.length === 0) {
      console.log('   No consumed IDs found');
    } else {
      for (const objectType of objectTypes) {
        const ids = consumption[objectType] as number[];
        if (ids && ids.length > 0) {
          totalIds += ids.length;
          const preview = ids.slice(0, 5).join(', ');
          const suffix = ids.length > 5 ? `... (+${ids.length - 5} more)` : '';
          console.log(`   ${objectType}: ${ids.length} IDs (${preview}${suffix})`);
        }
      }

      console.log('-'.repeat(40));
      console.log(`   Total: ${totalIds} consumed IDs`);
    }

    console.log();
    console.log(`✅ ${syncMode.toUpperCase()} sync mode test completed successfully!`);

  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
    if (error.stack) {
      console.log('\nStack trace:');
      console.log(error.stack);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx ts-node test-sync-modes.ts <app-folder-path> [merge|replace]');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node test-sync-modes.ts "C:\\MyALApps\\MyApp" merge');
    console.log('  npx ts-node test-sync-modes.ts ./my-al-app replace');
    console.log('  npx ts-node test-sync-modes.ts ./my-al-app  # defaults to merge');
    console.log('');
    console.log('Sync Modes:');
    console.log('  merge   - UPDATE/MERGE mode (PATCH) - merges with existing data');
    console.log('  replace - REPLACE mode (POST) - completely replaces data');
    process.exit(1);
  }

  const appPath = args[0];
  const syncMode = (args[1] as 'merge' | 'replace') || 'merge';

  if (syncMode !== 'merge' && syncMode !== 'replace') {
    console.log('❌ Invalid sync mode. Use "merge" or "replace"');
    process.exit(1);
  }

  await testSyncModes(appPath, syncMode);
}

if (require.main === module) {
  main().catch(console.error);
}