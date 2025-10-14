/**
 * Tests for AllocateIdTool
 */

import { AllocateIdTool } from './AllocateIdTool';

// Mock all dependencies before importing
jest.mock('../../lib/backend/BackendService', () => {
  return {
    BackendService: jest.fn().mockImplementation(() => ({
      allocateId: jest.fn(),
      storeAssignment: jest.fn()
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
    validateAppPath: jest.fn(),
    scanWorkspace: jest.fn()
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

describe('AllocateIdTool', () => {
  let tool: AllocateIdTool;
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
      readObjIdConfig: jest.fn().mockResolvedValue({
        idRanges: {
          table: [{ from: 1000, to: 1999 }],
          page: [{ from: 2000, to: 2999 }]
        }
      })
    };

    (ConfigManager.getInstance as jest.Mock).mockReturnValue(mockConfigInstance);

    // Setup BackendService mock
    mockBackendInstance = {
      allocateId: jest.fn(),
      storeAssignment: jest.fn().mockResolvedValue({ updated: true })
    };

    (BackendService as jest.Mock).mockImplementation(() => mockBackendInstance);

    // Setup WorkspaceUtils mocks
    (WorkspaceUtils.validateAppPath as jest.Mock).mockResolvedValue({ valid: true });
    (WorkspaceUtils.scanWorkspace as jest.Mock).mockResolvedValue([]);

    // Create tool instance
    tool = new AllocateIdTool();
  });

  it('should have correct tool definition', () => {
    const definition = tool.getDefinition();
    expect(definition.name).toBe('allocate_id');
    expect(definition.description).toBe('Preview, reserve, or reclaim object IDs for AL development. REQUIRES mode ("preview"|"reserve"|"reclaim"), appPath: absolute path to the workspace directory containing app.json and .objidconfig - NOT a file path. Example (OK): "C:\\Projects\\MyALApp" or "/home/user/MyALApp". Example (NOT OK): "path/to/app.json". REQUIRES object_type (AL object type string). Optional: count (number, default: 1), pool_id (string), preferred_range ({from:number, to:number}), object_metadata ({name?:string, file?:string, tag?:string}), ids (number[], reclaim mode only), dry_run (boolean, default: false), auto_track (boolean, reserve mode only, default: true - automatically stores assignments after reservation).');
  });

  describe('preview mode', () => {
    it('should preview available IDs', async () => {
      (WorkspaceUtils.scanWorkspace as jest.Mock).mockResolvedValue([
        { type: 'table', id: 1000, name: 'Table1', file: 'table1.al' },
        { type: 'table', id: 1001, name: 'Table2', file: 'table2.al' }
      ]);

      const result = await tool.execute({
        mode: 'preview',
        appPath: '/test/path',
        object_type: 'table',
        count: 3
      });

      expect(result.mode).toBe('preview');
      expect(result.ids).toEqual([1002, 1003, 1004]);
      expect(result.available_count).toBe(3);
      expect(mockBackendInstance.allocateId).not.toHaveBeenCalled();
    });

    it('should respect preferred range', async () => {
      mockConfigInstance.readObjIdConfig.mockResolvedValue({
        idRanges: {
          table: [
            { from: 1000, to: 1099 },
            { from: 2000, to: 2099 }
          ]
        }
      });

      const result = await tool.execute({
        mode: 'preview',
        appPath: '/test/path',
        object_type: 'table',
        count: 2,
        preferred_range: { from: 2000, to: 2099 }
      });

      expect(result.ids[0]).toBeGreaterThanOrEqual(2000);
      expect(result.ids[0]).toBeLessThanOrEqual(2099);
    });

    it('should throw when no IDs available', async () => {
      // Fill all IDs
      const consumedIds = Array.from({ length: 1000 }, (_, i) => ({
        type: 'table',
        id: 1000 + i,
        name: `Table${i}`,
        file: 'table.al'
      }));

      (WorkspaceUtils.scanWorkspace as jest.Mock).mockResolvedValue(consumedIds);

      await expect(tool.execute({
        mode: 'preview',
        appPath: '/test/path',
        object_type: 'table'
      })).rejects.toThrow('No available IDs found for table');
    });
  });

  describe('reserve mode', () => {
    it('should reserve IDs through backend', async () => {
      mockBackendInstance.allocateId.mockResolvedValue({
        mode: 'reserve',
        ids: [1002, 1003],
        object_type: 'table',
        reserved: true
      });

      const result = await tool.execute({
        mode: 'reserve',
        appPath: '/test/path',
        object_type: 'table',
        count: 2
      });

      expect(mockBackendInstance.allocateId).toHaveBeenCalledWith({
        mode: 'reserve',
        appPath: '/test/path',
        object_type: 'table',
        count: 2,
        dry_run: false,
        ranges: [{ from: 1000, to: 1999 }]
      });
      expect(result.reserved).toBe(true);
      expect(result.ids).toEqual([1002, 1003]);
    });

    it('should handle dry_run', async () => {
      (WorkspaceUtils.scanWorkspace as jest.Mock).mockResolvedValue([]);

      const result = await tool.execute({
        mode: 'reserve',
        appPath: '/test/path',
        object_type: 'table',
        count: 1,
        dry_run: true
      });

      expect(mockBackendInstance.allocateId).not.toHaveBeenCalled();
      expect(result.reserved).toBe(false);
      expect(result.dry_run).toBe(true);
    });

    it('should include metadata when provided', async () => {
      mockBackendInstance.allocateId.mockResolvedValue({
        mode: 'reserve',
        ids: [1002],
        object_type: 'table',
        reserved: true
      });

      const metadata = {
        name: 'Customer',
        file: 'Customer.Table.al',
        tag: 'v1.0'
      };

      const result = await tool.execute({
        mode: 'reserve',
        appPath: '/test/path',
        object_type: 'table',
        object_metadata: metadata
      });

      expect(result.metadata).toEqual(metadata);
    });

    describe('auto_track functionality', () => {
      beforeEach(() => {
        mockBackendInstance.allocateId.mockResolvedValue({
          mode: 'reserve',
          ids: [1002, 1003],
          object_type: 'table',
          reserved: true
        });
      });

      it('should auto-track assignments by default', async () => {
        await tool.execute({
          mode: 'reserve',
          appPath: '/test/path',
          object_type: 'table',
          count: 2
        });

        expect(mockBackendInstance.storeAssignment).toHaveBeenCalledTimes(2);
        expect(mockBackendInstance.storeAssignment).toHaveBeenCalledWith({
          appPath: '/test/path',
          authKey: undefined,
          type: 'table',
          id: 1002
        });
        expect(mockBackendInstance.storeAssignment).toHaveBeenCalledWith({
          appPath: '/test/path',
          authKey: undefined,
          type: 'table',
          id: 1003
        });
      });

      it('should auto-track when explicitly enabled', async () => {
        await tool.execute({
          mode: 'reserve',
          appPath: '/test/path',
          object_type: 'table',
          count: 2,
          auto_track: true
        });

        expect(mockBackendInstance.storeAssignment).toHaveBeenCalledTimes(2);
      });

      it('should not auto-track when disabled', async () => {
        await tool.execute({
          mode: 'reserve',
          appPath: '/test/path',
          object_type: 'table',
          count: 2,
          auto_track: false
        });

        expect(mockBackendInstance.storeAssignment).not.toHaveBeenCalled();
      });

      it('should pass authKey to storeAssignment', async () => {
        await tool.execute({
          mode: 'reserve',
          appPath: '/test/path',
          object_type: 'table',
          count: 2,
          authKey: 'test-key'
        });

        expect(mockBackendInstance.storeAssignment).toHaveBeenCalledWith({
          appPath: '/test/path',
          authKey: 'test-key',
          type: 'table',
          id: 1002
        });
      });

      it('should continue reserving even if tracking fails', async () => {
        mockBackendInstance.storeAssignment.mockRejectedValue(new Error('Tracking failed'));

        const result = await tool.execute({
          mode: 'reserve',
          appPath: '/test/path',
          object_type: 'table',
          count: 2
        });

        expect(result.reserved).toBe(true);
        expect(result.ids).toEqual([1002, 1003]);
        expect(mockBackendInstance.storeAssignment).toHaveBeenCalledTimes(2);
      });

      it('should track single ID correctly', async () => {
        mockBackendInstance.allocateId.mockResolvedValue({
          mode: 'reserve',
          ids: [1002],
          object_type: 'page',
          reserved: true
        });

        await tool.execute({
          mode: 'reserve',
          appPath: '/test/path',
          object_type: 'page',
          count: 1
        });

        expect(mockBackendInstance.storeAssignment).toHaveBeenCalledTimes(1);
        expect(mockBackendInstance.storeAssignment).toHaveBeenCalledWith({
          appPath: '/test/path',
          authKey: undefined,
          type: 'page',
          id: 1002
        });
      });

      it('should not track if no IDs returned', async () => {
        mockBackendInstance.allocateId.mockResolvedValue({
          mode: 'reserve',
          ids: [],
          object_type: 'table',
          reserved: true
        });

        await tool.execute({
          mode: 'reserve',
          appPath: '/test/path',
          object_type: 'table',
          count: 1
        });

        expect(mockBackendInstance.storeAssignment).not.toHaveBeenCalled();
      });

      it('should not track in dry_run mode', async () => {
        (WorkspaceUtils.scanWorkspace as jest.Mock).mockResolvedValue([]);

        await tool.execute({
          mode: 'reserve',
          appPath: '/test/path',
          object_type: 'table',
          count: 1,
          dry_run: true
        });

        expect(mockBackendInstance.storeAssignment).not.toHaveBeenCalled();
      });
    });
  });

  describe('reclaim mode', () => {
    it('should reclaim IDs', async () => {
      mockBackendInstance.allocateId.mockResolvedValue({
        mode: 'reclaim',
        ids: [1002, 1003],
        object_type: 'table',
        reclaimed_count: 2
      });

      const result = await tool.execute({
        mode: 'reclaim',
        appPath: '/test/path',
        object_type: 'table',
        ids: [1002, 1003]
      });

      expect(mockBackendInstance.allocateId).toHaveBeenCalledWith({
        mode: 'reclaim',
        appPath: '/test/path',
        object_type: 'table',
        ids: [1002, 1003],
        count: 1,
        dry_run: false
      });
      expect(result.reclaimed_count).toBe(2);
    });

    it('should throw when ids not provided', async () => {
      await expect(tool.execute({
        mode: 'reclaim',
        appPath: '/test/path',
        object_type: 'table'
      })).rejects.toThrow('ids parameter is required for reclaim mode');
    });

    it('should handle failed reclaims', async () => {
      mockBackendInstance.allocateId.mockResolvedValue({
        mode: 'reclaim',
        ids: [1002, 1003, 1004],
        object_type: 'table',
        reclaimed_count: 2,
        failed_ids: [1004]
      });

      const result = await tool.execute({
        mode: 'reclaim',
        appPath: '/test/path',
        object_type: 'table',
        ids: [1002, 1003, 1004]
      });

      expect(result.reclaimed_count).toBe(2);
      expect(result.failed_ids).toEqual([1004]);
    });
  });

  it('should throw error for invalid app path', async () => {
    (WorkspaceUtils.validateAppPath as jest.Mock).mockResolvedValue({
      valid: false,
      reason: 'Invalid path'
    });

    await expect(tool.execute({
      mode: 'preview',
      appPath: '/invalid/path',
      object_type: 'table'
    })).rejects.toThrow('Invalid path');
  });

  it('should throw when no config exists', async () => {
    mockConfigInstance.readObjIdConfig.mockResolvedValue(null);

    await expect(tool.execute({
      mode: 'preview',
      appPath: '/test/path',
      object_type: 'table'
    })).rejects.toThrow('No .objidconfig file found');
  });

  it('should throw when no ranges defined for object type', async () => {
    mockConfigInstance.readObjIdConfig.mockResolvedValue({
      idRanges: {
        page: [{ from: 2000, to: 2999 }]
      }
    });

    await expect(tool.execute({
      mode: 'preview',
      appPath: '/test/path',
      object_type: 'table'
    })).rejects.toThrow('No ID ranges defined for object type: table');
  });
});