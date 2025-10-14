/**
 * Tests for AuthorizationTool
 */

import { AuthorizationTool } from './AuthorizationTool';

// Mock all dependencies before importing
jest.mock('../../lib/backend/BackendService', () => {
  return {
    BackendService: jest.fn().mockImplementation(() => ({
      authorization: jest.fn()
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

describe('AuthorizationTool', () => {
  let tool: AuthorizationTool;
  let mockBackendInstance: any;
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
      readAppJson: jest.fn().mockResolvedValue({
        id: 'test-app',
        name: 'Test App',
        version: '1.0.0',
        publisher: 'Test Publisher'
      })
    };

    (ConfigManager.getInstance as jest.Mock).mockReturnValue(mockConfigInstance);

    // Setup BackendService mock
    mockBackendInstance = {
      authorization: jest.fn()
    };

    (BackendService as jest.Mock).mockImplementation(() => mockBackendInstance);

    // Setup WorkspaceUtils mock
    (WorkspaceUtils.validateAppPath as jest.Mock).mockResolvedValue({ valid: true });

    // Create tool instance
    tool = new AuthorizationTool();
  });

  it('should have correct tool definition', () => {
    const definition = tool.getDefinition();
    expect(definition.name).toBe('authorization');
    expect(definition.description).toBe('Manage app authorization for Object ID synchronization. REQUIRES action ("status"|"start"|"deauthorize"), appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/app.json". Optional: interactive (boolean, default: true).');
  });

  it('should handle status action', async () => {
    mockBackendInstance.authorization.mockResolvedValue({
      action: 'status',
      authorized: true
    });

    const result = await tool.execute({
      action: 'status',
      appPath: '/test/path'
    });

    expect(mockBackendInstance.authorization).toHaveBeenCalledWith({
      action: 'status',
      appPath: '/test/path',
      interactive: true
    });
    expect(result.action).toBe('status');
    expect(result.authorized).toBe(true);
    expect(result.app_info).toBeDefined();
    expect(result.app_info?.name).toBe('Test App');
  });

  it('should handle start action', async () => {
    mockBackendInstance.authorization.mockResolvedValue({
      action: 'start',
      authorized: true,
      authorization_key: 'test-key',
      expires_at: '2024-12-31T23:59:59Z'
    });

    const result = await tool.execute({
      action: 'start',
      appPath: '/test/path',
      interactive: true
    });

    expect(mockBackendInstance.authorization).toHaveBeenCalledWith({
      action: 'start',
      appPath: '/test/path',
      interactive: true
    });
    expect(result.action).toBe('start');
    expect(result.authorized).toBe(true);
    expect(result.authorization_key).toBe('test-key');
    expect(result.expires_at).toBe('2024-12-31T23:59:59Z');
  });

  it('should handle deauthorize action', async () => {
    mockBackendInstance.authorization.mockResolvedValue({
      action: 'deauthorize',
      authorized: false
    });

    const result = await tool.execute({
      action: 'deauthorize',
      appPath: '/test/path'
    });

    expect(mockBackendInstance.authorization).toHaveBeenCalledWith({
      action: 'deauthorize',
      appPath: '/test/path',
      interactive: true
    });
    expect(result.action).toBe('deauthorize');
    expect(result.authorized).toBe(false);
  });

  it('should throw error for invalid app path', async () => {
    (WorkspaceUtils.validateAppPath as jest.Mock).mockResolvedValue({
      valid: false,
      reason: 'Invalid path'
    });

    await expect(tool.execute({
      action: 'status',
      appPath: '/invalid/path'
    })).rejects.toThrow('Invalid path');

    expect(mockBackendInstance.authorization).not.toHaveBeenCalled();
  });

  it('should handle backend errors', async () => {
    mockBackendInstance.authorization.mockRejectedValue(new Error('Backend error'));

    await expect(tool.execute({
      action: 'status',
      appPath: '/test/path'
    })).rejects.toThrow('Backend error');
  });

  it('should not add app_info for unauthorized status', async () => {
    mockBackendInstance.authorization.mockResolvedValue({
      action: 'status',
      authorized: false
    });

    const result = await tool.execute({
      action: 'status',
      appPath: '/test/path'
    });

    expect(result.authorized).toBe(false);
    expect(result.app_info).toBeUndefined();
  });
});