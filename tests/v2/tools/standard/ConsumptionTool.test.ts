/**
 * Tests for ConsumptionTool
 */

import { ConsumptionTool } from '../../../../src/v2/tools/standard/ConsumptionTool';
import { BackendService } from '../../../../src/v2/lib/backend/BackendService';
import { ConfigManager } from '../../../../src/v2/lib/config/ConfigManager';
import { Logger } from '../../../../src/v2/lib/utils/logger';
import { WorkspaceUtils } from '../../../../src/v2/lib/utils/workspace';

// Mock dependencies
jest.mock('../../../../src/v2/lib/backend/BackendService');
jest.mock('../../../../src/v2/lib/config/ConfigManager');
jest.mock('../../../../src/v2/lib/utils/logger');
jest.mock('../../../../src/v2/lib/utils/workspace');

describe('ConsumptionTool', () => {
  let tool: ConsumptionTool;
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
      readConfig: jest.fn().mockResolvedValue({
        idRanges: {
          table: [{ from: 50000, to: 50099 }],
          page: [{ from: 50000, to: 50099 }]
        }
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

    // Mock WorkspaceUtils
    (WorkspaceUtils.validateAppPath as jest.Mock).mockResolvedValue({
      valid: true
    });

    tool = new ConsumptionTool();
  });

  describe('basic consumption data', () => {
    it('should get consumption summary', async () => {
      mockBackend.getConsumption = jest.fn().mockResolvedValue({
        table: [50001, 50002, 50003],
        page: [50001, 50002],
        _total: 5
      });

      const result = await tool.execute({
        appPath: '/test/app'
      });

      expect(result).toEqual({
        summary: {
          total_consumed: 5,
          by_type: {
            table: 3,
            page: 2
          }
        }
      });

      expect(mockBackend.getConsumption).toHaveBeenCalledWith({
        appPath: '/test/app',
        detailed: false,
        objectType: undefined
      });
    });
  });

  describe('detailed consumption data', () => {
    it('should get detailed consumption with IDs', async () => {
      mockBackend.getConsumption = jest.fn().mockResolvedValue({
        table: [50001, 50002]
      });

      const result = await tool.execute({
        appPath: '/test/app',
        detailed: true
      });

      expect(result).toEqual({
        summary: {
          total_consumed: 2,
          by_type: {
            table: 2
          }
        },
        details: [
          { type: 'table', id: 50001 },
          { type: 'table', id: 50002 }
        ]
      });
    });
  });

  describe('available IDs calculation', () => {
    it('should calculate available IDs when requested', async () => {
      mockBackend.getConsumption = jest.fn().mockResolvedValue({
        table: [50001, 50003, 50005],
        page: []
      });

      const result = await tool.execute({
        appPath: '/test/app',
        include_available: true
      });

      expect(result.available).toBeDefined();
      expect(result.available!.table).toContain(50000);
      expect(result.available!.table).toContain(50002);
      expect(result.available!.table).toContain(50004);
      expect(result.available!.table).not.toContain(50001);
      expect(result.available!.table).not.toContain(50003);
      expect(result.available!.page?.length).toBe(100); // All available
    });
  });

  describe('object type filtering', () => {
    it('should filter by object type', async () => {
      mockBackend.getConsumption = jest.fn().mockResolvedValue({
        table: [50001, 50002]
      });

      const result = await tool.execute({
        appPath: '/test/app',
        object_type: 'table'
      });

      expect(result.summary.by_type).toHaveProperty('table');
      expect(result.summary.total_consumed).toBe(2);

      expect(mockBackend.getConsumption).toHaveBeenCalledWith({
        appPath: '/test/app',
        detailed: false,
        objectType: 'table'
      });
    });
  });

  describe('error handling', () => {
    it('should handle invalid app path', async () => {
      (WorkspaceUtils.validateAppPath as jest.Mock).mockResolvedValue({
        valid: false,
        reason: 'app.json not found'
      });

      await expect(tool.execute({
        appPath: '/invalid/app'
      })).rejects.toThrow('app.json not found');
    });

    it('should handle backend errors', async () => {
      mockBackend.getConsumption = jest.fn().mockRejectedValue(
        new Error('Backend unavailable')
      );

      await expect(tool.execute({
        appPath: '/test/app'
      })).rejects.toThrow('Backend unavailable');
    });
  });
});