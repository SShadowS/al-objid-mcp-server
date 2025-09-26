#!/usr/bin/env node
/**
 * Helper script to run E2E tests
 * Checks if Azure Functions are running and provides helpful instructions
 */

import { spawn } from 'child_process';

async function checkBackend(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:7071/api/v2/health');
    return response.ok || response.status === 404; // 404 is ok, means the server is running
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🔍 Checking if Azure Functions backend is running...');

  const isRunning = await checkBackend();

  if (!isRunning) {
    console.log(`
❌ Azure Functions backend is not running at http://localhost:7071

To run E2E tests, you need to start the Azure Functions backend first:

Option 1: In a separate terminal:
  cd ../azure-function-app
  npm start

Option 2: Using the npm script (from mcp-server directory):
  npm run backend:start

Then run the E2E tests again:
  npm run test:e2e

For continuous testing with watch mode:
  npm run test:e2e:watch
`);
    process.exit(1);
  }

  console.log('✅ Azure Functions backend is running!');
  console.log('🚀 Starting E2E tests...\n');

  // Run the tests
  const testProcess = spawn('npm', ['run', 'test:e2e'], {
    stdio: 'inherit',
    shell: true
  });

  testProcess.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch(console.error);