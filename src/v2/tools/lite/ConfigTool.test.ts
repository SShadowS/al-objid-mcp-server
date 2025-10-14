/**
 * Tests for ConfigTool
 */

import { ConfigTool } from './ConfigTool';

// Mock all dependencies before importing
jest.mock('../../lib/config/ConfigManager', () => ({
  ConfigManager: {
    getInstance: jest.fn()
  }
}));

jest.mock('../../lib/utils/workspace', () => ({
  WorkspaceUtils: {
    validateAppPath: jest.fn()
  }
}));

jest.mock('../../lib/utils/logger', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    })
  }
}));

import { ConfigManager } from '../../lib/config/ConfigManager';
import { WorkspaceUtils } from '../../lib/utils/workspace';

describe('ConfigTool', () => {
  let tool: ConfigTool;
  let mockConfigInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup ConfigManager mock
    mockConfigInstance = {
      getServerConfig: jest.fn().mockReturnValue({
        mode: 'lite',
        backendUrl: 'http://localhost:7071',
        backendApiKey: undefined,
        cacheEnabled: true,
        cacheTtl: 300000,
        logLevel: 'info'
      }),
      readObjIdConfig: jest.fn(),
      writeObjIdConfig: jest.fn()
    };

    (ConfigManager.getInstance as jest.Mock).mockReturnValue(mockConfigInstance);
    (WorkspaceUtils.validateAppPath as jest.Mock).mockResolvedValue({ valid: true });

    // Create tool instance
    tool = new ConfigTool();
  });

  it('should have correct tool definition', () => {
    const definition = tool.getDefinition();
    expect(definition.name).toBe('config');
    expect(definition.description).toBe('Read, write, and validate .objidconfig configuration files. REQUIRES action ("read"|"write"|"validate"), appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/.objidconfig". Optional: keys (string[], read only), patch (object, write only), merge (boolean, write only, default: true), schema_version (string).');
  });

  describe('read action', () => {
    it('should read existing config', async () => {
      const mockConfig = {
        idRanges: {
          table: [{ from: 1000, to: 1999 }],
          page: [{ from: 2000, to: 2999 }]
        },
        objectNamePrefix: 'TEST',
        bcLicense: 'license.flf'
      };

      mockConfigInstance.readObjIdConfig.mockResolvedValue(mockConfig);

      const result = await tool.execute({
        action: 'read',
        appPath: '/test/path'
      });

      expect(mockConfigInstance.readObjIdConfig).toHaveBeenCalledWith('/test/path');
      expect(result.action).toBe('read');
      expect(result.exists).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.config).toEqual(mockConfig);
    });

    it('should filter by keys when specified', async () => {
      const mockConfig = {
        idRanges: {
          table: [{ from: 1000, to: 1999 }]
        },
        objectNamePrefix: 'TEST',
        bcLicense: 'license.flf'
      };

      mockConfigInstance.readObjIdConfig.mockResolvedValue(mockConfig);

      const result = await tool.execute({
        action: 'read',
        appPath: '/test/path',
        keys: ['idRanges']
      });

      expect(result.config).toEqual({
        idRanges: {
          table: [{ from: 1000, to: 1999 }]
        }
      });
    });

    it('should handle missing config', async () => {
      mockConfigInstance.readObjIdConfig.mockResolvedValue(null);

      const result = await tool.execute({
        action: 'read',
        appPath: '/test/path'
      });

      expect(result.exists).toBe(false);
      expect(result.valid).toBe(false);
      expect(result.validation).toBeDefined();
      expect(result.validation![0].message).toBe('Configuration file not found');
    });
  });

  describe('write action', () => {
    it('should write config with merge', async () => {
      const patch = {
        objectNamePrefix: 'NEW'
      };

      mockConfigInstance.readObjIdConfig.mockResolvedValue({
        idRanges: { table: [{ from: 1000, to: 1999 }] },
        objectNamePrefix: 'NEW'
      });

      const result = await tool.execute({
        action: 'write',
        appPath: '/test/path',
        patch,
        merge: true
      });

      expect(mockConfigInstance.writeObjIdConfig).toHaveBeenCalledWith(
        '/test/path',
        patch,
        true
      );
      expect(result.action).toBe('write');
      expect(result.exists).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('should throw error when patch is missing', async () => {
      await expect(tool.execute({
        action: 'write',
        appPath: '/test/path'
      })).rejects.toThrow('patch parameter is required for write action');
    });
  });

  describe('validate action', () => {
    it('should validate valid config', async () => {
      const mockConfig = {
        idRanges: {
          table: [{ from: 1000, to: 1999 }],
          page: [{ from: 2000, to: 2999 }]
        },
        objectNamePrefix: 'TEST'
      };

      mockConfigInstance.readObjIdConfig.mockResolvedValue(mockConfig);

      const result = await tool.execute({
        action: 'validate',
        appPath: '/test/path'
      });

      expect(result.action).toBe('validate');
      expect(result.exists).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.validation).toBeUndefined();
    });

    it('should detect missing ID ranges', async () => {
      mockConfigInstance.readObjIdConfig.mockResolvedValue({
        idRanges: {}
      });

      const result = await tool.execute({
        action: 'validate',
        appPath: '/test/path'
      });

      expect(result.valid).toBe(false);
      expect(result.validation).toBeDefined();
      expect(result.validation!.some(v => v.message === 'No ID ranges defined')).toBe(true);
    });

    it('should detect overlapping ranges', async () => {
      mockConfigInstance.readObjIdConfig.mockResolvedValue({
        idRanges: {
          table: [
            { from: 1000, to: 1999 },
            { from: 1500, to: 2500 }
          ]
        }
      });

      const result = await tool.execute({
        action: 'validate',
        appPath: '/test/path'
      });

      expect(result.valid).toBe(false);
      expect(result.validation).toBeDefined();
      expect(result.validation!.some(v => v.message.includes('Overlapping ranges'))).toBe(true);
    });

    it('should handle missing config file', async () => {
      mockConfigInstance.readObjIdConfig.mockResolvedValue(null);

      const result = await tool.execute({
        action: 'validate',
        appPath: '/test/path'
      });

      expect(result.exists).toBe(false);
      expect(result.valid).toBe(false);
      expect(result.validation![0].message).toBe('Configuration file not found');
    });
  });

  it('should throw error for invalid app path', async () => {
    (WorkspaceUtils.validateAppPath as jest.Mock).mockResolvedValue({
      valid: false,
      reason: 'Invalid path'
    });

    await expect(tool.execute({
      action: 'read',
      appPath: '/invalid/path'
    })).rejects.toThrow('Invalid path');
  });

  it('should throw error for invalid action', async () => {
    await expect(tool.execute({
      action: 'invalid' as any,
      appPath: '/test/path'
    })).rejects.toThrow('Invalid parameters');
  });
});