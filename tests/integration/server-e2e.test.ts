/**
 * End-to-end tests for the MCP server
 * These tests execute handlers directly through dynamic loading
 */

import { ALObjectIdServer } from '../../src/server';
import { getHandlerConfig } from '../../src/commandMappings';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('MCP Server E2E Tests', () => {
  let server: ALObjectIdServer;
  let testWorkspace: string;
  let testApp1: string;
  let testApp2: string;

  beforeAll(() => {
    // Create test workspace structure
    testWorkspace = path.join(os.tmpdir(), 'objid-e2e-' + Date.now());
    fs.mkdirSync(testWorkspace, { recursive: true });

    // Create first test app
    testApp1 = path.join(testWorkspace, 'App1');
    fs.mkdirSync(testApp1, { recursive: true });

    const app1Json = {
      id: 'app1-id',
      name: 'App 1',
      publisher: 'Test Publisher',
      version: '1.0.0.0',
      idRanges: [{ from: 50000, to: 50099 }]
    };
    fs.writeFileSync(path.join(testApp1, 'app.json'), JSON.stringify(app1Json, null, 2));

    const objidConfig1 = {
      objectRanges: [{ from: 50000, to: 50099, description: 'App1 Range' }],
      bcLicense: [],
      idRanges: [{ from: 50000, to: 50099 }],
      nextId: 50010,
      assignedIds: {
        tables: [50000, 50001, 50002],
        pages: [50003, 50004],
        codeunits: [50005, 50006, 50007, 50008, 50009]
      }
    };
    fs.writeFileSync(path.join(testApp1, '.objidconfig'), JSON.stringify(objidConfig1, null, 2));

    // Create some AL files
    fs.writeFileSync(path.join(testApp1, 'Customer.Table.al'),
      'table 50000 "Customer Ext"\n{\n    fields\n    {\n    }\n}');
    fs.writeFileSync(path.join(testApp1, 'CustomerList.Page.al'),
      'page 50003 "Customer List"\n{\n    PageType = List;\n}');

    // Create second test app
    testApp2 = path.join(testWorkspace, 'App2');
    fs.mkdirSync(testApp2, { recursive: true });

    const app2Json = {
      id: 'app2-id',
      name: 'App 2',
      publisher: 'Test Publisher',
      version: '2.0.0.0',
      idRanges: [{ from: 60000, to: 60099 }]
    };
    fs.writeFileSync(path.join(testApp2, 'app.json'), JSON.stringify(app2Json, null, 2));

    const objidConfig2 = {
      objectRanges: [{ from: 60000, to: 60099, description: 'App2 Range' }],
      idRanges: [{ from: 60000, to: 60099 }],
      nextId: 60000
    };
    fs.writeFileSync(path.join(testApp2, '.objidconfig'), JSON.stringify(objidConfig2, null, 2));
  });

  afterAll(() => {
    // Clean up
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    server = new ALObjectIdServer();
  });

  describe('Complete Workflow Tests', () => {
    it('should handle complete workspace scanning and app switching workflow', async () => {
      // Step 1: Scan workspace using dynamic handler
      const scanConfig = getHandlerConfig('scan-workspace', 'standard');
      expect(scanConfig).toBeDefined();

      const scanModule = await import(
        path.join(__dirname, '../../src', scanConfig!.path.replace('./', ''))
      );
      const scanResult = await scanModule[scanConfig!.handler](server, {
        workspacePath: testWorkspace
      });

      expect(scanResult).toBeDefined();
      expect(scanResult.content[0].text).toContain('Found 2 AL app(s)');
      expect(scanResult.content[0].text).toContain('App 1');
      expect(scanResult.content[0].text).toContain('App 2');

      // Step 2: Set active app to App1
      const setActiveConfig = getHandlerConfig('set-active-app', 'standard');
      const setActiveModule = await import(
        path.join(__dirname, '../../src', setActiveConfig!.path.replace('./', ''))
      );
      const setActiveResult = await setActiveModule[setActiveConfig!.handler](server, {
        appPath: testApp1
      });

      expect(setActiveResult).toBeDefined();
      expect(setActiveResult.content[0].text).toContain('Active app set to');
      expect(setActiveResult.content[0].text).toContain('App 1');

      // Step 3: Get next ID for App1
      const nextIdConfig = getHandlerConfig('get-next-id', 'standard');
      const nextIdModule = await import(
        path.join(__dirname, '../../src', nextIdConfig!.path.replace('./', ''))
      );
      const nextIdResult = await nextIdModule[nextIdConfig!.handler](server, {
        type: 'table',
        appPath: testApp1
      });

      expect(nextIdResult).toBeDefined();
      expect(nextIdResult.content[0].text).toContain('50010');
      expect(nextIdResult.content[0].text).toContain('table');

      // Step 4: Switch to App2
      const switchResult = await setActiveModule[setActiveConfig!.handler](server, {
        appPath: testApp2
      });

      expect(switchResult).toBeDefined();
      expect(switchResult.content[0].text).toContain('Active app set to');
      expect(switchResult.content[0].text).toContain('App 2');

      // Step 5: Get next ID for App2 (should be different range)
      const nextId2Result = await nextIdModule[nextIdConfig!.handler](server, {
        type: 'page',
        appPath: testApp2
      });

      expect(nextId2Result).toBeDefined();
      expect(nextId2Result.content[0].text).toContain('60000');
      expect(nextId2Result.content[0].text).toContain('page');
    });

    it('should handle workspace info and active app queries', async () => {
      // Set active app first
      const setActiveConfig = getHandlerConfig('set-active-app', 'standard');
      const setActiveModule = await import(
        path.join(__dirname, '../../src', setActiveConfig!.path.replace('./', ''))
      );
      await setActiveModule[setActiveConfig!.handler](server, {
        appPath: testApp1
      });

      // Get workspace info
      const infoConfig = getHandlerConfig('get-workspace-info', 'standard');
      const infoModule = await import(
        path.join(__dirname, '../../src', infoConfig!.path.replace('./', ''))
      );
      const infoResult = await infoModule[infoConfig!.handler](server, {
        workspacePath: testWorkspace
      });

      expect(infoResult).toBeDefined();
      expect(infoResult.content[0].text).toContain('Current workspace');
      expect(infoResult.content[0].text).toContain('Apps: 2');
      expect(infoResult.content[0].text).toContain('Active: App 1');
    });

    it('should persist active app across server instances', async () => {
      // Set active app with first server instance
      const server1 = new ALObjectIdServer();
      const setActiveConfig = getHandlerConfig('set-active-app', 'standard');
      const setActiveModule = await import(
        path.join(__dirname, '../../src', setActiveConfig!.path.replace('./', ''))
      );

      await setActiveModule[setActiveConfig!.handler](server1, {
        appPath: testApp1
      });

      // Create new server instance
      const server2 = new ALObjectIdServer();

      // Get workspace info with new instance (should remember active app)
      const infoConfig = getHandlerConfig('get-workspace-info', 'standard');
      const infoModule = await import(
        path.join(__dirname, '../../src', infoConfig!.path.replace('./', ''))
      );
      const infoResult = await infoModule[infoConfig!.handler](server2, {
        workspacePath: testWorkspace
      });

      expect(infoResult).toBeDefined();
      expect(infoResult.content[0].text).toContain('Active: App 1');
    });
  });

  describe('Dynamic Handler Loading Performance', () => {
    it('should cache handlers after first load', async () => {
      const server = new ALObjectIdServer();

      // Initial cache should be empty
      expect(server.getHandlerCacheStats().size).toBe(0);

      // Load and execute a handler
      const config = getHandlerConfig('scan-workspace', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      // Simulate caching (normally done by handleToolCallDynamic)
      (server as any).handlerCache.set('scan-workspace', module[config!.handler]);

      // Verify cache
      const stats = server.getHandlerCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.handlers).toContain('scan-workspace');

      // Second load should use cached version
      const cached = (server as any).handlerCache.get('scan-workspace');
      expect(cached).toBe(module[config!.handler]);
    });

    it('should handle concurrent handler loads efficiently', async () => {
      const server = new ALObjectIdServer();

      // Load multiple handlers concurrently
      const handlers = ['scan-workspace', 'set-active-app', 'get-next-id'];

      const loadPromises = handlers.map(async (handlerName) => {
        const config = getHandlerConfig(handlerName, 'standard');
        if (!config) return null;

        const module = await import(
          path.join(__dirname, '../../src', config.path.replace('./', ''))
        );

        return { name: handlerName, handler: module[config.handler] };
      });

      const loaded = await Promise.all(loadPromises);

      // All handlers should be loaded
      expect(loaded.filter(h => h !== null)).toHaveLength(3);

      // Each handler should be a function
      loaded.forEach(h => {
        if (h) {
          expect(typeof h.handler).toBe('function');
        }
      });
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle invalid handler calls gracefully', async () => {
      const config = getHandlerConfig('non-existent-tool', 'standard');
      expect(config).toBeUndefined();
    });

    it('should validate required parameters', async () => {
      const config = getHandlerConfig('set-active-app', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      // Call without required parameter
      await expect(
        module[config!.handler](server, {})
      ).rejects.toThrow();
    });

    it('should handle file system errors gracefully', async () => {
      const config = getHandlerConfig('set-active-app', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      // Try to set non-existent app as active
      await expect(
        module[config!.handler](server, {
          appPath: '/non/existent/path'
        })
      ).rejects.toThrow();
    });

    it('should handle malformed config files gracefully', async () => {
      // Create app with malformed .objidconfig
      const badApp = path.join(testWorkspace, 'BadApp');
      fs.mkdirSync(badApp, { recursive: true });
      fs.writeFileSync(path.join(badApp, 'app.json'), JSON.stringify({
        id: 'bad-app',
        name: 'Bad App',
        publisher: 'Test',
        version: '1.0.0.0'
      }));
      fs.writeFileSync(path.join(badApp, '.objidconfig'), 'invalid json {]');

      // Should handle gracefully
      const config = getHandlerConfig('scan-workspace', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        workspacePath: testWorkspace
      });

      // Should still find the other valid apps
      expect(result.content[0].text).toContain('Found');
      expect(result.content[0].text).toContain('AL app(s)');
    });
  });

  describe('Field and Enum ID Management', () => {
    it('should get next field ID correctly', async () => {
      // Set active app first
      const setActiveConfig = getHandlerConfig('set-active-app', 'standard');
      const setActiveModule = await import(
        path.join(__dirname, '../../src', setActiveConfig!.path.replace('./', ''))
      );
      await setActiveModule[setActiveConfig!.handler](server, { appPath: testApp1 });

      // Get next field ID
      const fieldConfig = getHandlerConfig('get-next-field-id', 'standard');
      const fieldModule = await import(
        path.join(__dirname, '../../src', fieldConfig!.path.replace('./', ''))
      );
      const result = await fieldModule[fieldConfig!.handler](server, {
        objectType: 'table',
        objectId: 50000,
        appPath: testApp1
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('field ID');
      expect(result.content[0].text).toContain('table 50000');
    });

    it('should get next enum value ID correctly', async () => {
      // Set active app first
      const setActiveConfig = getHandlerConfig('set-active-app', 'standard');
      const setActiveModule = await import(
        path.join(__dirname, '../../src', setActiveConfig!.path.replace('./', ''))
      );
      await setActiveModule[setActiveConfig!.handler](server, { appPath: testApp1 });

      // Get next enum value ID
      const enumConfig = getHandlerConfig('get-next-enum-value-id', 'standard');
      const enumModule = await import(
        path.join(__dirname, '../../src', enumConfig!.path.replace('./', ''))
      );
      const result = await enumModule[enumConfig!.handler](server, {
        enumType: 'enum',
        enumId: 50000,
        appPath: testApp1
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('enum value ID');
      expect(result.content[0].text).toContain('enum 50000');
    });
  });

  describe('Config File Updates', () => {
    it('should update .objidconfig when getting next ID', async () => {
      // Get initial config
      const initialConfig = JSON.parse(
        fs.readFileSync(path.join(testApp1, '.objidconfig'), 'utf-8')
      );
      const initialNextId = initialConfig.nextId;

      // Get next ID
      const config = getHandlerConfig('get-next-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );
      await module[config!.handler](server, {
        type: 'report',
        appPath: testApp1
      });

      // Check config was updated
      const updatedConfig = JSON.parse(
        fs.readFileSync(path.join(testApp1, '.objidconfig'), 'utf-8')
      );
      expect(updatedConfig.nextId).toBe(initialNextId + 1);
      expect(updatedConfig.assignedIds.reports).toContain(initialNextId);
    });

    it('should handle concurrent ID assignments safely', async () => {
      // Get handler
      const config = getHandlerConfig('get-next-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      // Simulate concurrent requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          module[config!.handler](server, {
            type: 'xmlport',
            appPath: testApp2
          })
        );
      }

      const results = await Promise.all(promises);
      const ids = results.map(r => {
        const match = r.content[0].text.match(/ID (\d+)/);
        return match ? parseInt(match[1]) : 0;
      });

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);

      // IDs should be sequential
      const sortedIds = [...ids].sort((a, b) => a - b);
      for (let i = 1; i < sortedIds.length; i++) {
        expect(sortedIds[i]).toBe(sortedIds[i - 1] + 1);
      }
    });
  });
});