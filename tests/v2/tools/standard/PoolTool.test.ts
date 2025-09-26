/**
 * Tests for PoolTool
 */

import { PoolTool } from '../../../../src/v2/tools/standard/PoolTool';
import { BackendService } from '../../../../src/v2/lib/backend/BackendService';
import { ConfigManager } from '../../../../src/v2/lib/config/ConfigManager';
import { Logger } from '../../../../src/v2/lib/utils/logger';

// Mock dependencies
jest.mock('../../../../src/v2/lib/backend/BackendService');
jest.mock('../../../../src/v2/lib/config/ConfigManager');
jest.mock('../../../../src/v2/lib/utils/logger');

describe('PoolTool', () => {
  let tool: PoolTool;
  let mockBackend: jest.Mocked<BackendService>;
  let mockConfig: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ConfigManager
    const mockGetInstance = ConfigManager.getInstance as jest.Mock;
    mockConfig = {
      getServerConfig: jest.fn().mockReturnValue({
        backendUrl: 'https://test.backend.com',
        backendApiKey: 'test-key'
      }),
      readAppJson: jest.fn().mockResolvedValue({
        id: 'test-app-id',
        name: 'Test App'
      })
    } as any;
    mockGetInstance.mockReturnValue(mockConfig);

    // Mock BackendService
    mockBackend = new BackendService() as jest.Mocked<BackendService>;
    (BackendService as jest.Mock).mockImplementation(() => mockBackend);

    // Mock Logger
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);

    tool = new PoolTool();
  });

  describe('create action', () => {
    it('should create a pool successfully', async () => {
      mockBackend.pool = jest.fn().mockResolvedValue({
        poolId: 'pool-123',
        success: true
      });

      const result = await tool.execute({
        action: 'create',
        appPath: '/test/app',
        poolName: 'Test Pool',
        description: 'A test pool'
      });

      expect(result).toEqual({
        action: 'create',
        success: true,
        poolId: 'pool-123',
        poolName: 'Test Pool',
        message: 'Pool "Test Pool" created successfully'
      });

      expect(mockBackend.pool).toHaveBeenCalledWith({
        action: 'create',
        appId: 'test-app-id',
        poolName: 'Test Pool',
        description: 'A test pool'
      });
    });

    it('should fail when pool name is missing', async () => {
      await expect(tool.execute({
        action: 'create',
        appPath: '/test/app'
      })).rejects.toThrow('Pool name is required');
    });
  });

  describe('join action', () => {
    it('should join a pool successfully', async () => {
      mockBackend.pool = jest.fn().mockResolvedValue({
        poolId: 'pool-123',
        success: true
      });

      const result = await tool.execute({
        action: 'join',
        appPath: '/test/app',
        poolId: 'pool-123'
      });

      expect(result).toEqual({
        action: 'join',
        success: true,
        poolId: 'pool-123',
        message: 'Successfully joined pool'
      });
    });

    it('should fail when neither poolId nor poolName is provided', async () => {
      await expect(tool.execute({
        action: 'join',
        appPath: '/test/app'
      })).rejects.toThrow('Pool ID or name is required');
    });
  });

  describe('leave action', () => {
    it('should leave a pool successfully', async () => {
      mockBackend.pool = jest.fn().mockResolvedValue({
        success: true
      });

      const result = await tool.execute({
        action: 'leave',
        appPath: '/test/app'
      });

      expect(result).toEqual({
        action: 'leave',
        success: true,
        message: 'Successfully left the pool'
      });
    });
  });

  describe('info action', () => {
    it('should get pool info successfully', async () => {
      // Mock the backend response to match actual backend structure
      mockBackend.pool = jest.fn().mockResolvedValue({
        name: 'Test Pool',
        apps: [
          { appId: 'app1', name: 'App 1' },
          { appId: 'app2', name: 'App 2' }
        ]
      });

      const result = await tool.execute({
        action: 'info',
        appPath: '/test/app'
      });

      // PoolTool transforms the backend response to this structure
      expect(result).toEqual({
        action: 'info',
        success: true,
        poolInfo: {
          id: '',  // Backend doesn't return poolId in getPoolInfo response
          name: 'Test Pool',
          description: undefined,
          apps: ['App 1', 'App 2'],  // Transformed from app objects to string array
          created: expect.any(String),
          updated: expect.any(String)
        }
      });
    });
  });

  describe('remove action', () => {
    it('should remove a pool with force flag', async () => {
      mockBackend.pool = jest.fn().mockResolvedValue({
        success: true
      });

      const result = await tool.execute({
        action: 'remove',
        appPath: '/test/app',
        poolId: 'pool-123',
        force: true
      });

      expect(result).toEqual({
        action: 'remove',
        success: true,
        message: 'Pool removed successfully'
      });
    });

    it('should fail without force flag', async () => {
      await expect(tool.execute({
        action: 'remove',
        appPath: '/test/app',
        poolId: 'pool-123'
      })).rejects.toThrow('Force flag is required');
    });
  });

  describe('rename action', () => {
    it('should rename a pool successfully', async () => {
      mockBackend.pool = jest.fn().mockResolvedValue({
        success: true
      });

      const result = await tool.execute({
        action: 'rename',
        appPath: '/test/app',
        poolId: 'pool-123',
        poolName: 'New Pool Name'
      });

      expect(result).toEqual({
        action: 'rename',
        success: true,
        poolName: 'New Pool Name',
        message: 'Pool renamed to "New Pool Name"'
      });
    });

    it('should fail when new name is missing', async () => {
      await expect(tool.execute({
        action: 'rename',
        appPath: '/test/app',
        poolId: 'pool-123'
      })).rejects.toThrow('New pool name is required');
    });
  });
});