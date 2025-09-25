import { ALObjectIdServer } from '../../src/server';
import { getHandlerConfig } from '../../src/commandMappings';
import * as fs from 'fs';
import * as path from 'path';

describe('Dynamic Handler Loading', () => {
  let server: ALObjectIdServer;

  beforeEach(() => {
    server = new ALObjectIdServer();
  });

  describe('Handler Configuration', () => {
    it('should return correct handler config for lite tier commands', () => {
      const config = getHandlerConfig('get-next-id', 'lite');
      expect(config).toBeDefined();
      expect(config?.path).toContain('handlers/standard/');
      expect(config?.handler).toBe('handleGetNextId');
    });

    it('should return correct handler config for full tier commands', () => {
      const config = getHandlerConfig('assign-ids', 'full');
      expect(config).toBeDefined();
      expect(config?.path).toContain('handlers/full/');
      expect(config?.handler).toBe('handleAssignIds');
    });

    it('should return undefined for commands not in tier', () => {
      // assign-ids is only in full tier
      const config = getHandlerConfig('assign-ids', 'lite');
      expect(config).toBeUndefined();
    });

    it('should return undefined for unknown commands', () => {
      const config = getHandlerConfig('unknown-command', 'full');
      expect(config).toBeUndefined();
    });
  });

  describe('Handler Cache', () => {
    it('should start with empty cache', () => {
      const stats = server.getHandlerCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.handlers).toEqual([]);
    });

    it('should clear specific handler from cache', () => {
      // This would need the handler to be loaded first in a real scenario
      server.clearHandlerCache('get-next-id');
      const stats = server.getHandlerCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should clear all handlers from cache', () => {
      server.clearHandlerCache();
      const stats = server.getHandlerCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Handler Path Resolution', () => {
    it('should resolve lite handler paths correctly', () => {
      const liteCommands = [
        'get-next-id',
        'scan-workspace',
        'set-active-app'
      ];

      liteCommands.forEach(cmd => {
        const config = getHandlerConfig(cmd, 'lite');
        expect(config).toBeDefined();
        expect(config?.path).toMatch(/\.\/handlers\/standard\//);
      });
    });

    it('should resolve full handler paths correctly', () => {
      const fullCommands = [
        'assign-ids',
        'batch-assign',
        'reserve-range',
        'get-suggestions'
      ];

      fullCommands.forEach(cmd => {
        const config = getHandlerConfig(cmd, 'full');
        expect(config).toBeDefined();
        expect(config?.path).toMatch(/\.\/handlers\/full\//);
      });
    });
  });

  describe('Tier Fallback', () => {
    it('should use lite handlers for lite tier', () => {
      const config = getHandlerConfig('get-next-id', 'lite');
      expect(config).toBeDefined();
      expect(config?.path).toContain('handlers/standard/');
    });

    it('should have access to all handlers in full tier', () => {
      // Standard handler should be available in full tier
      const standardConfig = getHandlerConfig('get-next-id', 'full');
      expect(standardConfig).toBeDefined();

      // Full handler should be available in full tier
      const fullConfig = getHandlerConfig('assign-ids', 'full');
      expect(fullConfig).toBeDefined();
    });
  });

  describe('Handler File Existence', () => {
    it('should have actual handler files for all lite commands', () => {
      const liteCommands = ['get-next-id', 'scan-workspace', 'set-active-app'];

      liteCommands.forEach(cmd => {
        const config = getHandlerConfig(cmd, 'lite');
        expect(config).toBeDefined();

        // Convert relative path to absolute path
        const handlerPath = config!.path.replace('./', '');
        const fullPath = path.join(__dirname, '../../src', handlerPath + '.ts');

        // Check if the file exists
        const exists = fs.existsSync(fullPath);
        expect(exists).toBe(true);
      });
    });

    it('should have actual handler files for all standard commands', () => {
      const standardCommands = [
        'check-authorization',
        'authorize-app',
        'get-consumption-report',
        'get-workspace-info',
        'get-next-field-id',
        'get-next-enum-value-id'
      ];

      standardCommands.forEach(cmd => {
        const config = getHandlerConfig(cmd, 'standard');
        if (config) {
          const handlerPath = config.path.replace('./', '');
          const fullPath = path.join(__dirname, '../../src', handlerPath + '.ts');
          const exists = fs.existsSync(fullPath);
          expect(exists).toBe(true);
        }
      });
    });

    it('should have actual handler files for all full commands', () => {
      const fullCommands = [
        'assign-ids',
        'batch-assign',
        'reserve-range',
        'get-suggestions'
      ];

      fullCommands.forEach(cmd => {
        const config = getHandlerConfig(cmd, 'full');
        if (config) {
          const handlerPath = config.path.replace('./', '');
          const fullPath = path.join(__dirname, '../../src', handlerPath + '.ts');
          const exists = fs.existsSync(fullPath);
          expect(exists).toBe(true);
        }
      });
    });
  });
});