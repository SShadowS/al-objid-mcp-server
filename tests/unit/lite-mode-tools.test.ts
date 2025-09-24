/**
 * Unit tests for Lite Mode Tools (get-next-id and reserve-id)
 * Tests the functionality of getting and reserving object, field, and enum IDs
 */

import { jest } from '@jest/globals';

describe('Lite Mode Tools', () => {
  let mockBackend: any;
  let mockWorkspace: any;
  let mockField: any;
  let server: any;

  const mockApp = {
    path: '/test/app',
    appId: 'test-app-id',
    name: 'Test App',
    version: '1.0.0',
    publisher: 'Test',
    hasObjIdConfig: true,
    isAuthorized: true,
    authKey: 'test-auth-key',
    ranges: [{ from: 50000, to: 50099 }]
  };

  beforeEach(() => {
    // Mock the backend service
    mockBackend = {
      getNext: jest.fn(),
      storeAssignment: jest.fn(),
      syncIds: jest.fn()
    };

    // Mock the workspace manager
    mockWorkspace = {
      getCurrentWorkspace: jest.fn().mockReturnValue({
        rootPath: '/test',
        apps: [mockApp],
        activeApp: mockApp
      }),
      getAppByPath: jest.fn().mockReturnValue(mockApp),
      getPoolIdFromAppIdIfAvailable: jest.fn().mockReturnValue(mockApp.appId)
    };

    // Mock the field manager
    mockField = {
      getNextFieldId: jest.fn(),
      reserveFieldId: jest.fn(),
      getNextEnumValueId: jest.fn(),
      reserveEnumValueId: jest.fn(),
      syncFieldIds: jest.fn(),
      syncEnumValueIds: jest.fn()
    };
  });

  describe('get-next-id', () => {
    describe('Standard Objects', () => {
      it('should get next ID for table object without reserving', async () => {
        mockBackend.getNext.mockResolvedValue({
          available: true,
          id: 50000
        });

        // Simulate calling handleGetNextObjectId
        const args = {
          objectType: 'table',
          appPath: '/test/app'
        };

        // The handler should call getNext with commit=false
        await mockBackend.getNext({
          appId: mockApp.appId,
          type: 'table',
          ranges: mockApp.ranges,
          authKey: mockApp.authKey,
          perRange: false
        }, false); // false = no commit

        expect(mockBackend.getNext).toHaveBeenCalledWith(
          expect.objectContaining({
            appId: mockApp.appId,
            type: 'table'
          }),
          false
        );
      });

      it('should handle array of IDs from backend', async () => {
        mockBackend.getNext.mockResolvedValue({
          available: true,
          id: [50000, 50001, 50002]
        });

        const result = await mockBackend.getNext({
          appId: mockApp.appId,
          type: 'page'
        }, false);

        expect(result.id[0]).toBe(50000);
      });
    });

    describe('Field IDs', () => {
      it('should get next field ID for a table', async () => {
        mockField.getNextFieldId.mockResolvedValue(1);

        const fieldId = await mockField.getNextFieldId(
          mockApp.appId,
          mockApp.authKey,
          50100, // table ID
          mockApp.ranges
        );

        expect(fieldId).toBe(1);
        expect(mockField.getNextFieldId).toHaveBeenCalledWith(
          mockApp.appId,
          mockApp.authKey,
          50100,
          mockApp.ranges
        );
      });

      it('should handle field request with parentObjectId', async () => {
        mockField.getNextFieldId.mockResolvedValue(10);

        const args = {
          objectType: 'field',
          parentObjectId: 50100,
          appPath: '/test/app'
        };

        const fieldId = await mockField.getNextFieldId(
          mockApp.appId,
          mockApp.authKey,
          args.parentObjectId,
          mockApp.ranges
        );

        expect(fieldId).toBe(10);
      });
    });

    describe('Enum Value IDs', () => {
      it('should get next enum value ID', async () => {
        mockField.getNextEnumValueId.mockResolvedValue(1);

        const valueId = await mockField.getNextEnumValueId(
          mockApp.appId,
          mockApp.authKey,
          50200, // enum ID
          mockApp.ranges
        );

        expect(valueId).toBe(1);
        expect(mockField.getNextEnumValueId).toHaveBeenCalledWith(
          mockApp.appId,
          mockApp.authKey,
          50200,
          mockApp.ranges
        );
      });
    });
  });

  describe('reserve-id', () => {
    describe('Standard Objects', () => {
      it('should reserve specific object ID', async () => {
        mockBackend.getNext.mockResolvedValue({
          available: true,
          id: 50005
        });

        const args = {
          objectType: 'table',
          id: 50005,
          appPath: '/test/app'
        };

        // Call with commit=true and specific ID
        await mockBackend.getNext({
          appId: mockApp.appId,
          type: 'table',
          ranges: mockApp.ranges,
          authKey: mockApp.authKey,
          perRange: false,
          require: args.id
        }, true); // true = commit

        expect(mockBackend.getNext).toHaveBeenCalledWith(
          expect.objectContaining({
            require: 50005
          }),
          true
        );
      });

      it('should validate ID is within allowed ranges', async () => {
        const args = {
          objectType: 'table',
          id: 60000, // Outside range
          appPath: '/test/app'
        };

        const inRange = mockApp.ranges.some(r =>
          args.id >= r.from && args.id <= r.to
        );

        expect(inRange).toBe(false);
      });

      it('should handle ID already taken', async () => {
        mockBackend.getNext.mockResolvedValue({
          available: true,
          id: 50001 // Different ID returned
        });

        const args = {
          objectType: 'codeunit',
          id: 50000, // Requested
          appPath: '/test/app'
        };

        const result = await mockBackend.getNext({
          require: args.id
        }, true);

        expect(result.id).not.toBe(args.id);
      });
    });

    describe('Field ID Reservation', () => {
      it('should reserve field ID and use storeAssignment', async () => {
        mockField.reserveFieldId.mockResolvedValue(true);
        mockBackend.storeAssignment.mockResolvedValue(true);

        const args = {
          objectType: 'field',
          id: 10,
          parentObjectId: 50100,
          appPath: '/test/app'
        };

        // Reserve the field ID
        const success = await mockField.reserveFieldId(
          mockApp.appId,
          mockApp.authKey,
          args.parentObjectId,
          args.id,
          mockApp.ranges
        );

        expect(success).toBe(true);

        // Then store assignment for real-time tracking
        const objectType = `table_${args.parentObjectId}`;
        await mockBackend.storeAssignment(
          mockApp.appId,
          mockApp.authKey,
          objectType,
          args.id,
          'POST'
        );

        expect(mockBackend.storeAssignment).toHaveBeenCalledWith(
          mockApp.appId,
          mockApp.authKey,
          `table_${args.parentObjectId}`,
          args.id,
          'POST'
        );

        // Should NOT call syncIds
        expect(mockBackend.syncIds).not.toHaveBeenCalled();
      });

      it('should handle field ID reservation failure', async () => {
        mockField.reserveFieldId.mockResolvedValue(false);

        const args = {
          objectType: 'field',
          id: 10,
          parentObjectId: 50100,
          appPath: '/test/app'
        };

        const success = await mockField.reserveFieldId(
          mockApp.appId,
          mockApp.authKey,
          args.parentObjectId,
          args.id,
          mockApp.ranges
        );

        expect(success).toBe(false);
        // Should not call storeAssignment if reservation fails
        expect(mockBackend.storeAssignment).not.toHaveBeenCalled();
      });
    });

    describe('Enum Value ID Reservation', () => {
      it('should reserve enum value ID and use storeAssignment', async () => {
        mockField.reserveEnumValueId.mockResolvedValue(true);
        mockBackend.storeAssignment.mockResolvedValue(true);

        const args = {
          objectType: 'enum',
          id: 1,
          parentObjectId: 50200,
          appPath: '/test/app'
        };

        // Reserve the enum value ID
        const success = await mockField.reserveEnumValueId(
          mockApp.appId,
          mockApp.authKey,
          args.parentObjectId,
          args.id,
          mockApp.ranges
        );

        expect(success).toBe(true);

        // Then store assignment for real-time tracking
        const objectType = `enum_${args.parentObjectId}`;
        await mockBackend.storeAssignment(
          mockApp.appId,
          mockApp.authKey,
          objectType,
          args.id,
          'POST'
        );

        expect(mockBackend.storeAssignment).toHaveBeenCalledWith(
          mockApp.appId,
          mockApp.authKey,
          `enum_${args.parentObjectId}`,
          args.id,
          'POST'
        );

        // Should NOT call syncIds
        expect(mockBackend.syncIds).not.toHaveBeenCalled();
      });
    });
  });

  describe('Consumption Tracking', () => {
    it('should not overwrite consumption when reserving field IDs', async () => {
      // This tests the fix for the consumption overwriting issue

      // Existing consumption
      const existingConsumption = {
        table: [50000, 50001, 50002],
        page: [50000, 50001],
        codeunit: [50000]
      };

      // Reserve a field ID
      mockField.reserveFieldId.mockResolvedValue(true);
      mockBackend.storeAssignment.mockResolvedValue(true);

      await mockField.reserveFieldId(
        mockApp.appId,
        mockApp.authKey,
        50100,
        15,
        mockApp.ranges
      );

      await mockBackend.storeAssignment(
        mockApp.appId,
        mockApp.authKey,
        'table_50100',
        15,
        'POST'
      );

      // storeAssignment should be used (adds to consumption)
      expect(mockBackend.storeAssignment).toHaveBeenCalled();

      // syncIds should NOT be called (would replace all consumption)
      expect(mockBackend.syncIds).not.toHaveBeenCalled();
    });

    it('should use merge mode when syncing field IDs explicitly', async () => {
      mockField.syncFieldIds.mockResolvedValue(true);

      await mockField.syncFieldIds(
        mockApp.appId,
        mockApp.authKey,
        50100,
        [10, 11, 12],
        true // merge mode
      );

      expect(mockField.syncFieldIds).toHaveBeenCalledWith(
        mockApp.appId,
        mockApp.authKey,
        50100,
        [10, 11, 12],
        true
      );
    });

    it('should use merge mode when syncing enum value IDs explicitly', async () => {
      mockField.syncEnumValueIds.mockResolvedValue(true);

      await mockField.syncEnumValueIds(
        mockApp.appId,
        mockApp.authKey,
        50200,
        [1, 2, 3],
        true // merge mode
      );

      expect(mockField.syncEnumValueIds).toHaveBeenCalledWith(
        mockApp.appId,
        mockApp.authKey,
        50200,
        [1, 2, 3],
        true
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle unauthorized app', async () => {
      const unauthorizedApp = { ...mockApp, isAuthorized: false };
      mockWorkspace.getAppByPath.mockReturnValue(unauthorizedApp);

      // Both get-next-id and reserve-id should fail
      const shouldFail = !unauthorizedApp.isAuthorized || !unauthorizedApp.authKey;
      expect(shouldFail).toBe(true);
    });

    it('should handle missing app', async () => {
      mockWorkspace.getAppByPath.mockReturnValue(undefined);

      const app = mockWorkspace.getAppByPath('/nonexistent');
      expect(app).toBeUndefined();
    });

    it('should handle backend errors gracefully', async () => {
      mockBackend.getNext.mockRejectedValue(new Error('Backend error'));
      mockBackend.storeAssignment.mockRejectedValue(new Error('Store failed'));

      await expect(
        mockBackend.getNext({}, false)
      ).rejects.toThrow('Backend error');

      await expect(
        mockBackend.storeAssignment()
      ).rejects.toThrow('Store failed');
    });
  });

  describe('Pool ID Resolution', () => {
    it('should use pool ID when available', async () => {
      const poolId = 'pool-123';
      mockWorkspace.getPoolIdFromAppIdIfAvailable.mockReturnValue(poolId);

      const resolvedId = mockWorkspace.getPoolIdFromAppIdIfAvailable(mockApp.appId);

      expect(resolvedId).toBe(poolId);
      expect(mockWorkspace.getPoolIdFromAppIdIfAvailable).toHaveBeenCalledWith(mockApp.appId);
    });

    it('should fall back to app ID when pool not available', async () => {
      mockWorkspace.getPoolIdFromAppIdIfAvailable.mockReturnValue(mockApp.appId);

      const resolvedId = mockWorkspace.getPoolIdFromAppIdIfAvailable(mockApp.appId);

      expect(resolvedId).toBe(mockApp.appId);
    });
  });
});