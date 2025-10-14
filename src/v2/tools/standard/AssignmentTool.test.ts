/**
 * Tests for AssignmentTool
 */

import { AssignmentTool } from './AssignmentTool';

// Mock all dependencies before importing
jest.mock('../../lib/backend/BackendService', () => {
  return {
    BackendService: jest.fn().mockImplementation(() => ({
      storeAssignment: jest.fn(),
      removeAssignment: jest.fn(),
      getConsumption: jest.fn()
    }))
  };
});

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

import { BackendService } from '../../lib/backend/BackendService';
import { ConfigManager } from '../../lib/config/ConfigManager';
import { WorkspaceUtils } from '../../lib/utils/workspace';

describe('AssignmentTool', () => {
  let tool: AssignmentTool;
  let mockBackendInstance: any;
  let mockConfigInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup ConfigManager mock
    mockConfigInstance = {
      getServerConfig: jest.fn().mockReturnValue({
        mode: 'standard',
        backendUrl: 'http://localhost:7071',
        backendApiKey: undefined,
        cacheEnabled: true,
        cacheTtl: 300000,
        logLevel: 'info'
      })
    };

    (ConfigManager.getInstance as jest.Mock).mockReturnValue(mockConfigInstance);

    // Setup BackendService mock
    mockBackendInstance = {
      storeAssignment: jest.fn(),
      removeAssignment: jest.fn(),
      getConsumption: jest.fn()
    };

    (BackendService as jest.Mock).mockImplementation(() => mockBackendInstance);

    // Setup WorkspaceUtils mock
    (WorkspaceUtils.validateAppPath as jest.Mock).mockResolvedValue({ valid: true });

    // Create tool instance
    tool = new AssignmentTool();
  });

  it('should have correct tool definition', () => {
    const definition = tool.getDefinition();
    expect(definition.name).toBe('assignment');
    expect(definition.description).toBe('Manually track or untrack object ID assignments. REQUIRES action ("store"|"remove"|"check"), appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/app.json". REQUIRES object_type (AL object type string), id (number). Optional: authKey (string, authorization key for backend).');
  });

  describe('store action', () => {
    it('should successfully store an assignment', async () => {
      mockBackendInstance.storeAssignment.mockResolvedValue({
        updated: true
      });

      const result = await tool.execute({
        action: 'store',
        appPath: '/test/path',
        object_type: 'table',
        id: 1000
      });

      expect(mockBackendInstance.storeAssignment).toHaveBeenCalledWith({
        appPath: '/test/path',
        authKey: undefined,
        type: 'table',
        id: 1000
      });
      expect(result.action).toBe('store');
      expect(result.success).toBe(true);
      expect(result.object_type).toBe('table');
      expect(result.id).toBe(1000);
      expect(result.message).toBe('Successfully stored assignment for table 1000');
    });

    it('should handle failed store', async () => {
      mockBackendInstance.storeAssignment.mockResolvedValue({
        updated: false
      });

      const result = await tool.execute({
        action: 'store',
        appPath: '/test/path',
        object_type: 'page',
        id: 2000
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to store assignment for page 2000');
    });

    it('should pass authKey to backend', async () => {
      mockBackendInstance.storeAssignment.mockResolvedValue({
        updated: true
      });

      await tool.execute({
        action: 'store',
        appPath: '/test/path',
        object_type: 'table',
        id: 1000,
        authKey: 'test-key'
      });

      expect(mockBackendInstance.storeAssignment).toHaveBeenCalledWith({
        appPath: '/test/path',
        authKey: 'test-key',
        type: 'table',
        id: 1000
      });
    });

    it('should handle backend errors', async () => {
      mockBackendInstance.storeAssignment.mockRejectedValue(new Error('Backend error'));

      await expect(tool.execute({
        action: 'store',
        appPath: '/test/path',
        object_type: 'table',
        id: 1000
      })).rejects.toThrow('Backend error');
    });
  });

  describe('remove action', () => {
    it('should successfully remove an assignment', async () => {
      mockBackendInstance.removeAssignment.mockResolvedValue({
        updated: true
      });

      const result = await tool.execute({
        action: 'remove',
        appPath: '/test/path',
        object_type: 'table',
        id: 1000
      });

      expect(mockBackendInstance.removeAssignment).toHaveBeenCalledWith({
        appPath: '/test/path',
        authKey: undefined,
        type: 'table',
        id: 1000
      });
      expect(result.action).toBe('remove');
      expect(result.success).toBe(true);
      expect(result.object_type).toBe('table');
      expect(result.id).toBe(1000);
      expect(result.message).toBe('Successfully removed assignment for table 1000');
    });

    it('should handle failed remove', async () => {
      mockBackendInstance.removeAssignment.mockResolvedValue({
        updated: false
      });

      const result = await tool.execute({
        action: 'remove',
        appPath: '/test/path',
        object_type: 'codeunit',
        id: 3000
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to remove assignment for codeunit 3000');
    });

    it('should handle backend errors', async () => {
      mockBackendInstance.removeAssignment.mockRejectedValue(new Error('Backend error'));

      await expect(tool.execute({
        action: 'remove',
        appPath: '/test/path',
        object_type: 'table',
        id: 1000
      })).rejects.toThrow('Backend error');
    });
  });

  describe('check action', () => {
    it('should check if ID is tracked', async () => {
      mockBackendInstance.getConsumption.mockResolvedValue({
        table: [1000, 1001, 1002],
        page: [2000, 2001]
      });

      const result = await tool.execute({
        action: 'check',
        appPath: '/test/path',
        object_type: 'table',
        id: 1001
      });

      expect(mockBackendInstance.getConsumption).toHaveBeenCalledWith({
        appPath: '/test/path',
        authKey: undefined
      });
      expect(result.action).toBe('check');
      expect(result.success).toBe(true);
      expect(result.tracked).toBe(true);
      expect(result.message).toBe('table 1001 is tracked');
    });

    it('should check if ID is not tracked', async () => {
      mockBackendInstance.getConsumption.mockResolvedValue({
        table: [1000, 1001, 1002],
        page: [2000, 2001]
      });

      const result = await tool.execute({
        action: 'check',
        appPath: '/test/path',
        object_type: 'table',
        id: 1005
      });

      expect(result.tracked).toBe(false);
      expect(result.message).toBe('table 1005 is not tracked');
    });

    it('should handle object with id property', async () => {
      mockBackendInstance.getConsumption.mockResolvedValue({
        table: [
          { id: 1000, name: 'Test' },
          { id: 1001, name: 'Test2' }
        ]
      });

      const result = await tool.execute({
        action: 'check',
        appPath: '/test/path',
        object_type: 'table',
        id: 1001
      });

      expect(result.tracked).toBe(true);
      expect(result.message).toBe('table 1001 is tracked');
    });

    it('should handle missing object type in consumption', async () => {
      mockBackendInstance.getConsumption.mockResolvedValue({
        page: [2000, 2001]
      });

      const result = await tool.execute({
        action: 'check',
        appPath: '/test/path',
        object_type: 'table',
        id: 1000
      });

      expect(result.tracked).toBe(false);
    });

    it('should handle backend errors', async () => {
      mockBackendInstance.getConsumption.mockRejectedValue(new Error('Backend error'));

      await expect(tool.execute({
        action: 'check',
        appPath: '/test/path',
        object_type: 'table',
        id: 1000
      })).rejects.toThrow('Backend error');
    });
  });

  it('should throw error for invalid app path', async () => {
    (WorkspaceUtils.validateAppPath as jest.Mock).mockResolvedValue({
      valid: false,
      reason: 'Invalid path'
    });

    await expect(tool.execute({
      action: 'store',
      appPath: '/invalid/path',
      object_type: 'table',
      id: 1000
    })).rejects.toThrow('Invalid path');

    expect(mockBackendInstance.storeAssignment).not.toHaveBeenCalled();
  });

  it('should throw error for invalid action', async () => {
    await expect(tool.execute({
      action: 'invalid' as any,
      appPath: '/test/path',
      object_type: 'table',
      id: 1000
    })).rejects.toThrow('Invalid parameters');
  });
});
