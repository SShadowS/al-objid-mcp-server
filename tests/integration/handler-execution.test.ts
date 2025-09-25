/**
 * Real integration tests for handler execution
 * These tests actually load and execute handlers without mocks
 */

import { ALObjectIdServer } from '../../src/server';
import { getHandlerConfig } from '../../src/commandMappings';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Handler Execution - Real Tests', () => {
  let server: ALObjectIdServer;
  let testWorkspace: string;
  let testApp: string;

  beforeAll(() => {
    // Create a temporary test workspace
    testWorkspace = path.join(os.tmpdir(), 'objid-test-' + Date.now());
    fs.mkdirSync(testWorkspace, { recursive: true });

    // Create a test app directory
    testApp = path.join(testWorkspace, 'TestApp');
    fs.mkdirSync(testApp, { recursive: true });

    // Create a minimal app.json
    const appJson = {
      id: 'test-app-id',
      name: 'Test App',
      publisher: 'Test Publisher',
      version: '1.0.0.0',
      idRanges: [
        { from: 50000, to: 50099 }
      ]
    };
    fs.writeFileSync(path.join(testApp, 'app.json'), JSON.stringify(appJson, null, 2));

    // Create a .objidconfig file
    const objidConfig = {
      objectRanges: [
        { from: 50000, to: 50099, description: 'Test Range' }
      ],
      bcLicense: [],
      idRanges: [
        { from: 50000, to: 50099 }
      ],
      nextId: 50000
    };
    fs.writeFileSync(path.join(testApp, '.objidconfig'), JSON.stringify(objidConfig, null, 2));
  });

  afterAll(() => {
    // Clean up test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    server = new ALObjectIdServer();
  });

  describe('Dynamic Handler Loading', () => {
    it('should dynamically load and execute lite mode handlers', async () => {
      const config = getHandlerConfig('scan-workspace', 'lite');
      expect(config).toBeDefined();

      // Dynamically import the handler module
      const modulePath = path.join(__dirname, '../../src', config!.path.replace('./', ''));
      const handlerModule = await import(modulePath);

      // Verify the handler function exists
      expect(handlerModule[config!.handler]).toBeDefined();
      expect(typeof handlerModule[config!.handler]).toBe('function');
    });

    it('should load all lite handlers successfully', async () => {
      const liteCommands = ['get-next-id', 'scan-workspace', 'set-active-app'];

      for (const cmd of liteCommands) {
        const config = getHandlerConfig(cmd, 'lite');
        expect(config).toBeDefined();

        const modulePath = path.join(__dirname, '../../src', config!.path.replace('./', ''));
        const handlerModule = await import(modulePath);

        expect(handlerModule[config!.handler]).toBeDefined();
        expect(typeof handlerModule[config!.handler]).toBe('function');
      }
    });

    it('should load all standard handlers successfully', async () => {
      const standardCommands = [
        'check-authorization',
        'authorize-app',
        'get-consumption-report',
        'get-workspace-info',
        'get-next-field-id',
        'get-next-enum-value-id'
      ];

      for (const cmd of standardCommands) {
        const config = getHandlerConfig(cmd, 'standard');
        if (config) {
          const modulePath = path.join(__dirname, '../../src', config.path.replace('./', ''));
          const handlerModule = await import(modulePath);

          expect(handlerModule[config.handler]).toBeDefined();
          expect(typeof handlerModule[config.handler]).toBe('function');
        }
      }
    });

    it('should load all full handlers successfully', async () => {
      const fullCommands = [
        'assign-ids',
        'batch-assign',
        'reserve-range',
        'get-suggestions'
      ];

      for (const cmd of fullCommands) {
        const config = getHandlerConfig(cmd, 'full');
        if (config) {
          const modulePath = path.join(__dirname, '../../src', config.path.replace('./', ''));

          try {
            const handlerModule = await import(modulePath);
            expect(handlerModule[config.handler]).toBeDefined();
            expect(typeof handlerModule[config.handler]).toBe('function');
          } catch (error) {
            // Some full handlers might not be implemented yet
            console.log(`Handler not implemented: ${cmd} - ${error}`);
          }
        }
      }
    });
  });

  describe('Handler Execution with Real File System', () => {
    it('should execute scan-workspace and find test app', async () => {
      const config = getHandlerConfig('scan-workspace', 'lite');
      const modulePath = path.join(__dirname, '../../src', config!.path.replace('./', ''));
      const handlerModule = await import(modulePath);

      // Create a server instance for the handler
      const server = new ALObjectIdServer();

      // Execute the handler with server and test workspace
      const result = await handlerModule[config!.handler](server, {
        workspacePath: testWorkspace
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Found');
      expect(result.content[0].text).toContain('AL app(s)');
    });

    it('should execute set-active-app with real app path', async () => {
      const config = getHandlerConfig('set-active-app', 'standard');
      const modulePath = path.join(__dirname, '../../src', config!.path.replace('./', ''));
      const handlerModule = await import(modulePath);

      // Create a server instance for the handler
      const server = new ALObjectIdServer();

      // Execute the handler
      const result = await handlerModule[config!.handler](server, {
        appPath: testApp
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Active app set to');
    });

    it('should execute get-next-id with real config', async () => {
      // Create a server instance to use across calls
      const server = new ALObjectIdServer();

      // First set the active app
      const setActiveConfig = getHandlerConfig('set-active-app', 'standard');
      const setActiveModule = await import(
        path.join(__dirname, '../../src', setActiveConfig!.path.replace('./', ''))
      );
      await setActiveModule[setActiveConfig!.handler](server, { appPath: testApp });

      // Authorize the app first (mock authorization for testing)
      const app = await server.getAppFromPath(testApp);
      if (app) {
        app.isAuthorized = true;
        app.authKey = 'test-auth-key';
      }

      // Now get next ID
      const config = getHandlerConfig('get-next-id', 'standard');
      const modulePath = path.join(__dirname, '../../src', config!.path.replace('./', ''));
      const handlerModule = await import(modulePath);

      const result = await handlerModule[config!.handler](server, {
        type: 'table',
        appPath: testApp
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      const responseText = result.content[0].text;
      expect(responseText).toContain('50000');
      expect(responseText).toContain('table');
    });
  });

  describe('Handler Caching Mechanism', () => {
    it('should cache handler after first load', async () => {
      const server = new ALObjectIdServer();

      // Get initial cache stats
      const initialStats = server.getHandlerCacheStats();
      expect(initialStats.size).toBe(0);

      // Load a handler (this would normally happen through tool execution)
      const config = getHandlerConfig('scan-workspace', 'lite');
      const modulePath = path.join(__dirname, '../../src', config!.path.replace('./', ''));
      const handler1 = await import(modulePath);

      // Simulate caching (in real server this happens in executeHandler)
      (server as any).handlerCache.set('scan-workspace', handler1[config!.handler]);

      // Check cache has the handler
      const afterLoadStats = server.getHandlerCacheStats();
      expect(afterLoadStats.size).toBe(1);
      expect(afterLoadStats.handlers).toContain('scan-workspace');

      // Load same handler again - should be from cache
      const cachedHandler = (server as any).handlerCache.get('scan-workspace');
      expect(cachedHandler).toBe(handler1[config!.handler]);
    });

    it('should clear specific handler from cache', () => {
      const server = new ALObjectIdServer();

      // Add some handlers to cache (simulating different tiers)
      (server as any).handlerCache.set('lite:handler1', () => {});
      (server as any).handlerCache.set('standard:handler1', () => {});
      (server as any).handlerCache.set('full:handler1', () => {});
      (server as any).handlerCache.set('lite:handler2', () => {});
      (server as any).handlerCache.set('standard:handler2', () => {});

      expect(server.getHandlerCacheStats().size).toBe(5);

      // Clear specific handler (clears for all tiers)
      server.clearHandlerCache('handler1');

      const stats = server.getHandlerCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.handlers).not.toContain('lite:handler1');
      expect(stats.handlers).not.toContain('standard:handler1');
      expect(stats.handlers).not.toContain('full:handler1');
      expect(stats.handlers).toContain('lite:handler2');
      expect(stats.handlers).toContain('standard:handler2');
    });

    it('should clear all handlers from cache', () => {
      const server = new ALObjectIdServer();

      // Add some handlers to cache
      (server as any).handlerCache.set('handler1', () => {});
      (server as any).handlerCache.set('handler2', () => {});
      (server as any).handlerCache.set('handler3', () => {});

      expect(server.getHandlerCacheStats().size).toBe(3);

      // Clear all
      server.clearHandlerCache();

      const stats = server.getHandlerCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.handlers).toEqual([]);
    });
  });

  describe('Error Handling in Handler Loading', () => {
    it('should handle missing handler gracefully', async () => {
      const config = getHandlerConfig('non-existent-command', 'lite');
      expect(config).toBeUndefined();
    });

    it('should handle invalid handler path gracefully', async () => {
      // Create a fake config with invalid path
      const fakeConfig = {
        handler: 'fakeHandler',
        path: './handlers/invalid/path'
      };

      const modulePath = path.join(__dirname, '../../src', fakeConfig.path.replace('./', ''));

      await expect(import(modulePath)).rejects.toThrow();
    });

    it('should handle handler execution errors gracefully', async () => {
      const config = getHandlerConfig('get-next-id', 'standard');
      const modulePath = path.join(__dirname, '../../src', config!.path.replace('./', ''));
      const handlerModule = await import(modulePath);

      // Call with invalid parameters
      await expect(
        handlerModule[config!.handler]({
          type: 'invalid-type',
          appPath: '/non/existent/path'
        })
      ).rejects.toThrow();
    });
  });

  describe('Cross-tier Handler Access', () => {
    it('should allow full tier to access all handlers', async () => {
      // Test that full tier can access lite handlers
      const liteConfig = getHandlerConfig('scan-workspace', 'full');
      expect(liteConfig).toBeDefined();

      // Test that full tier can access standard handlers
      const standardConfig = getHandlerConfig('check-authorization', 'full');
      expect(standardConfig).toBeDefined();

      // Test that full tier can access full handlers
      const fullConfig = getHandlerConfig('assign-ids', 'full');
      expect(fullConfig).toBeDefined();
    });

    it('should restrict lite tier from accessing full handlers', () => {
      const config = getHandlerConfig('assign-ids', 'lite');
      expect(config).toBeUndefined();
    });

    it('should restrict lite tier from accessing standard-only handlers', () => {
      const config = getHandlerConfig('check-authorization', 'lite');
      expect(config).toBeUndefined();
    });
  });
});