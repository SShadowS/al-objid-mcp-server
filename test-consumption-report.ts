#!/usr/bin/env ts-node

/**
 * Test script to fetch consumption report for an AL app folder
 * Usage: npx ts-node test-consumption-report.ts <app-folder-path>
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

async function testConsumptionReport(appPath: string): Promise<void> {
  console.log('🚀 AL Object ID Ninja - Consumption Report Test');
  console.log('='.repeat(60));

  try {
    // Load app information
    console.log(`📂 Loading app from: ${appPath}`);
    const app = await loadAppFromFolder(appPath);

    console.log(`📱 App: ${app.name} v${app.version}`);
    console.log(`🆔 App ID: ${app.appId}`);
    console.log(`🔐 Auth Key: ${app.authKey ? app.authKey.substring(0, 8) + '...' : 'NOT FOUND'}`);
    console.log();

    if (!app.authKey) {
      console.log('❌ No auth key found. Please ensure the app is authorized with Object ID Ninja.');
      console.log('   Auth key should be in .bclicense file as: authKey=your-key-here');
      return;
    }

    // Initialize backend service
    const backendService = new BackendService();

    console.log('🌐 Fetching consumption report...');

    // Get pool ID if available (matches VSCode extension behavior)
    const appId = await getPoolIdFromAppIdIfAvailable(app.appId, app.path);
    console.log(`🎯 Using App ID: ${appId === app.appId ? 'Raw App ID' : 'Pool ID'} (${appId.substring(0, 8)}...)`);

    // Fetch consumption report
    const request = {
      appId,
      authKey: app.authKey
    };

    const result = await backendService.getConsumption(request);

    if (!result) {
      console.log('❌ Failed to retrieve consumption report');
      console.log('   Possible causes:');
      console.log('   - Invalid auth key');
      console.log('   - App not authorized');
      console.log('   - Network connectivity issues');
      return;
    }

    console.log('✅ Consumption report retrieved successfully!');
    console.log();
    console.log('📊 Object ID Consumption:');
    console.log('-'.repeat(40));

    let totalIds = 0;
    const objectTypes = Object.keys(result).sort();

    if (objectTypes.length === 0) {
      console.log('   No consumed IDs found');
    } else {
      for (const objectType of objectTypes) {
        const ids = result[objectType] as number[];
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
    console.log('Usage: npx ts-node test-consumption-report.ts <app-folder-path>');
    console.log('');
    console.log('Example:');
    console.log('  npx ts-node test-consumption-report.ts "C:\\MyALApps\\MyApp"');
    console.log('  npx ts-node test-consumption-report.ts ./my-al-app');
    process.exit(1);
  }

  const appPath = args[0];
  await testConsumptionReport(appPath);
}

if (require.main === module) {
  main().catch(console.error);
}