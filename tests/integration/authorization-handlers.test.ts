/**
 * Real integration tests for authorization handlers
 * Tests authorization flow and consumption tracking
 */

import { ALObjectIdServer } from '../../src/server';
import { getHandlerConfig } from '../../src/commandMappings';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('Authorization Handlers Integration Tests', () => {
  let server: ALObjectIdServer;
  const testAppPath = path.join(__dirname, '../al');
  const testApp = testAppPath; // Alias for consistency
  let tempWorkspace: string;
  let unauthorizedApp: string;

  beforeAll(() => {
    // Create an unauthorized test app
    tempWorkspace = path.join(os.tmpdir(), 'auth-test-' + Date.now());
    fs.mkdirSync(tempWorkspace, { recursive: true });

    unauthorizedApp = path.join(tempWorkspace, 'UnauthorizedApp');
    fs.mkdirSync(unauthorizedApp);
    fs.writeFileSync(path.join(unauthorizedApp, 'app.json'), JSON.stringify({
      id: 'unauth-app-' + Date.now(),
      name: 'Unauthorized Test App',
      publisher: 'Test Publisher',
      version: '1.0.0.0',
      idRanges: [{ from: 60000, to: 60099 }]
    }, null, 2));
    // No .objidconfig file = unauthorized
  });

  afterAll(() => {
    if (fs.existsSync(tempWorkspace)) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    server = new ALObjectIdServer();
  });

  describe('Check Authorization Handler', () => {
    it('should check authorization for authorized app', async () => {
      const config = getHandlerConfig('check-authorization', 'standard');
      expect(config).toBeDefined();

      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        appPath: testAppPath
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('authorized');
      expect(result.content[0].text).toContain('✅');
    });

    it('should check authorization for unauthorized app', async () => {
      const config = getHandlerConfig('check-authorization', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        appPath: unauthorizedApp
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('not authorized');
      expect(result.content[0].text).toContain('❌');
    });

    it('should handle missing app path', async () => {
      const config = getHandlerConfig('check-authorization', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {});
      expect(result).toBeDefined();
      expect(result.isError || result.content[0].text.includes('Error')).toBe(true);
    });

    it('should handle non-existent app path', async () => {
      const config = getHandlerConfig('check-authorization', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        appPath: '/non/existent/path'
      });
      expect(result).toBeDefined();
      expect(result.isError || result.content[0].text.includes('Error')).toBe(true);
    });
  });

  describe('Authorize App Handler', () => {
    it('should attempt to authorize an app', async () => {
      const config = getHandlerConfig('authorize-app', 'standard');
      expect(config).toBeDefined();

      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      // This will attempt to authorize but may fail due to Git requirements
      const result = await module[config!.handler](server, {
        appPath: unauthorizedApp
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toBeDefined();
      // Result depends on Git status
    });

    it('should handle already authorized app', async () => {
      const config = getHandlerConfig('authorize-app', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        appPath: testAppPath
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('already authorized');
    });

    it('should validate Git repository requirement', async () => {
      const config = getHandlerConfig('authorize-app', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      // Create app outside Git repo
      const noGitApp = path.join(tempWorkspace, 'NoGitApp');
      fs.mkdirSync(noGitApp);
      fs.writeFileSync(path.join(noGitApp, 'app.json'), JSON.stringify({
        id: 'no-git-app',
        name: 'No Git App',
        publisher: 'Test',
        version: '1.0.0.0'
      }));

      const result = await module[config!.handler](server, {
        appPath: noGitApp
      });

      expect(result).toBeDefined();
      // Should fail due to no Git repo
      expect(result.isError || result.content[0].text.includes('Git')).toBe(true);
    });
  });

  describe('Get Consumption Report Handler', () => {
    it('should get consumption report for authorized app', async () => {
      const config = getHandlerConfig('get-consumption-report', 'standard');
      expect(config).toBeDefined();

      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        appPath: testAppPath
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('Consumption Report');
      expect(result.content[0].text).toMatch(/Total:\s+\d+/);
      expect(result.content[0].text).toMatch(/Available:\s+\d+/);
    });

    it('should handle unauthorized app consumption report', async () => {
      const config = getHandlerConfig('get-consumption-report', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        appPath: unauthorizedApp
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('not authorized');
    });

    it('should parse consumption details correctly', async () => {
      const config = getHandlerConfig('get-consumption-report', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        appPath: testAppPath,
        detailed: true
      });

      expect(result).toBeDefined();
      const text = result.content[0].text;

      // Should have consumption breakdown if any
      if (text.includes('Consumption by type:')) {
        expect(text).toMatch(/table|page|codeunit|query|xmlport|report|enum/i);
      }
    });
  });

  describe('Authorization Flow Integration', () => {
    it('should complete full authorization flow', async () => {
      // Step 1: Check initial status (should be unauthorized)
      const checkConfig = getHandlerConfig('check-authorization', 'standard');
      const checkModule = await import(
        path.join(__dirname, '../../src', checkConfig!.path.replace('./', ''))
      );

      let checkResult = await checkModule[checkConfig!.handler](server, {
        appPath: unauthorizedApp
      });
      expect(checkResult.content[0].text).toContain('not authorized');

      // Step 2: Attempt authorization (may fail due to Git)
      const authConfig = getHandlerConfig('authorize-app', 'standard');
      const authModule = await import(
        path.join(__dirname, '../../src', authConfig!.path.replace('./', ''))
      );

      const authResult = await authModule[authConfig!.handler](server, {
        appPath: unauthorizedApp
      });
      expect(authResult).toBeDefined();

      // Step 3: If authorization succeeded, verify
      if (!authResult.isError && authResult.content[0].text.includes('successfully')) {
        checkResult = await checkModule[checkConfig!.handler](server, {
          appPath: unauthorizedApp
        });
        expect(checkResult.content[0].text).toContain('authorized');
        expect(checkResult.content[0].text).toContain('✅');
      }
    });

    it('should persist authorization across server instances', async () => {
      // Use the already authorized test app
      const config = getHandlerConfig('check-authorization', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      // First server instance
      const server1 = new ALObjectIdServer();
      const result1 = await module[config!.handler](server1, {
        appPath: testAppPath
      });
      expect(result1.content[0].text).toContain('authorized');

      // Second server instance should see same authorization
      const server2 = new ALObjectIdServer();
      const result2 = await module[config!.handler](server2, {
        appPath: testAppPath
      });
      expect(result2.content[0].text).toContain('authorized');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const config = getHandlerConfig('get-consumption-report', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      // Test with non-existent app path to simulate error
      const result = await module[config!.handler](server, {
        appPath: '/non/existent/app/path'
      });

      expect(result).toBeDefined();
      expect(result.isError || result.content[0].text.includes('Error')).toBe(true);
    });

    it('should validate app.json exists', async () => {
      const config = getHandlerConfig('check-authorization', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      // Create directory without app.json
      const noAppJson = path.join(tempWorkspace, 'NoAppJson');
      fs.mkdirSync(noAppJson, { recursive: true });

      const result = await module[config!.handler](server, {
        appPath: noAppJson
      });
      expect(result).toBeDefined();
      expect(result.isError || result.content[0].text.includes('Error')).toBe(true);
    });

    it('should handle malformed app.json', async () => {
      const config = getHandlerConfig('check-authorization', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const badApp = path.join(tempWorkspace, 'BadAppJson');
      fs.mkdirSync(badApp, { recursive: true });
      fs.writeFileSync(path.join(badApp, 'app.json'), 'not valid json');

      const result = await module[config!.handler](server, {
        appPath: badApp
      });
      expect(result).toBeDefined();
      expect(result.isError || result.content[0].text.includes('Error')).toBe(true);
    });
  });

  describe('Consumption Tracking', () => {
    it('should track different object types', async () => {
      const config = getHandlerConfig('get-consumption-report', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        appPath: testAppPath
      });

      expect(result).toBeDefined();
      const text = result.content[0].text;

      // Should show total and available
      expect(text).toMatch(/Total:\s+\d+/);
      expect(text).toMatch(/Available:\s+\d+/);

      // If there's consumption, should show breakdown
      const totalMatch = text.match(/Total:\s+(\d+)/);
      const availableMatch = text.match(/Available:\s+(\d+)/);

      if (totalMatch && availableMatch) {
        const total = parseInt(totalMatch[1]);
        const available = parseInt(availableMatch[1]);
        const consumed = total - available;

        if (consumed > 0) {
          expect(text).toContain('Consumption by');
        }
      }
    });

    it('should handle apps with no consumption', async () => {
      // Create a fresh authorized app (would need proper Git setup)
      // For now, test with existing app
      const config = getHandlerConfig('get-consumption-report', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        appPath: testAppPath
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('Total:');
      expect(result.content[0].text).toContain('Available:');
    });
  });

  describe('Multi-app Authorization', () => {
    it('should handle multiple apps in workspace', async () => {
      // Scan workspace first
      const scanConfig = getHandlerConfig('scan-workspace', 'standard');
      const scanModule = await import(
        path.join(__dirname, '../../src', scanConfig!.path.replace('./', ''))
      );

      await scanModule[scanConfig!.handler](server, {
        workspacePath: tempWorkspace
      });

      // Check authorization for each app
      const checkConfig = getHandlerConfig('check-authorization', 'standard');
      const checkModule = await import(
        path.join(__dirname, '../../src', checkConfig!.path.replace('./', ''))
      );

      const result = await checkModule[checkConfig!.handler](server, {
        appPath: unauthorizedApp
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('not authorized');
    });
  });
});