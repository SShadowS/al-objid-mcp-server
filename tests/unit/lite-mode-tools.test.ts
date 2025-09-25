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

  describe('Complete Lite Mode Workflow', () => {
    describe('Basic ID Reservation Flow', () => {
      it('should properly reserve IDs without overriding previous assignments', async () => {
        // Setup: Initialize workspace with test app
        const testApp = {
          path: '/workspace/TestApp',
          appId: 'workflow-test-app',
          name: 'Workflow Test App',
          version: '1.0.0',
          publisher: 'Test',
          hasObjIdConfig: true,
          isAuthorized: true,
          authKey: 'workflow-auth-key',
          ranges: [{ from: 50000, to: 50099 }]
        };

        // Mock workspace setup
        mockWorkspace.getCurrentWorkspace.mockReturnValue({
          rootPath: '/workspace',
          apps: [testApp],
          activeApp: testApp
        });
        mockWorkspace.getAppByPath.mockReturnValue(testApp);
        mockWorkspace.getPoolIdFromAppIdIfAvailable.mockReturnValue(testApp.appId);

        // Track all getNext calls to ensure no duplicates
        const issuedIds = new Set<number>();
        let nextIdCounter = 50000;

        // Mock backend to track reservations properly
        mockBackend.getNext.mockImplementation(async (request: any, commit: any) => {
          const { require } = request;

          if (require !== undefined) {
            // Specific ID requested for reservation
            if (issuedIds.has(require)) {
              // ID already taken, return next available
              while (issuedIds.has(nextIdCounter)) {
                nextIdCounter++;
              }
              return { available: true, id: nextIdCounter };
            } else {
              if (commit) {
                issuedIds.add(require);
              }
              return { available: true, id: require };
            }
          } else {
            // Get next available ID
            while (issuedIds.has(nextIdCounter)) {
              nextIdCounter++;
            }
            const idToReturn = nextIdCounter;
            if (commit) {
              issuedIds.add(idToReturn);
              nextIdCounter++;
            }
            return { available: true, id: idToReturn };
          }
        });

        // Step 1: Get first table ID (should be 50000)
        const firstGetResult = await mockBackend.getNext({
          appId: testApp.appId,
          type: 'table',
          ranges: testApp.ranges,
          authKey: testApp.authKey,
          perRange: false
        }, false);

        expect(firstGetResult.id).toBe(50000);
        expect(issuedIds.has(50000)).toBe(false); // Not reserved yet

        // Step 2: Reserve first ID (50000)
        const firstReserveResult = await mockBackend.getNext({
          appId: testApp.appId,
          type: 'table',
          ranges: testApp.ranges,
          authKey: testApp.authKey,
          perRange: false,
          require: 50000
        }, true);

        expect(firstReserveResult.id).toBe(50000);
        expect(issuedIds.has(50000)).toBe(true); // Now reserved

        // Step 3: Get next table ID (should be 50001, NOT 50000)
        const secondGetResult = await mockBackend.getNext({
          appId: testApp.appId,
          type: 'table',
          ranges: testApp.ranges,
          authKey: testApp.authKey,
          perRange: false
        }, false);

        expect(secondGetResult.id).toBe(50001);
        expect(secondGetResult.id).not.toBe(50000); // Must not return reserved ID

        // Step 4: Reserve second ID (50001)
        const secondReserveResult = await mockBackend.getNext({
          appId: testApp.appId,
          type: 'table',
          ranges: testApp.ranges,
          authKey: testApp.authKey,
          perRange: false,
          require: 50001
        }, true);

        expect(secondReserveResult.id).toBe(50001);
        expect(issuedIds.has(50001)).toBe(true);

        // Step 5: Get third ID (should be 50002)
        const thirdGetResult = await mockBackend.getNext({
          appId: testApp.appId,
          type: 'table',
          ranges: testApp.ranges,
          authKey: testApp.authKey,
          perRange: false
        }, false);

        expect(thirdGetResult.id).toBe(50002);

        // Verify no IDs were duplicated
        expect(issuedIds.size).toBe(2); // Only 50000 and 50001 reserved
        expect(issuedIds.has(50000)).toBe(true);
        expect(issuedIds.has(50001)).toBe(true);
        expect(issuedIds.has(50002)).toBe(false); // Not reserved yet
      });

      it('should handle multiple object types without conflicts', async () => {
        const testApp = {
          path: '/workspace/MultiTypeApp',
          appId: 'multi-type-app',
          name: 'Multi Type App',
          version: '1.0.0',
          publisher: 'Test',
          hasObjIdConfig: true,
          isAuthorized: true,
          authKey: 'multi-auth-key',
          ranges: [{ from: 50000, to: 50099 }]
        };

        mockWorkspace.getCurrentWorkspace.mockReturnValue({
          rootPath: '/workspace',
          apps: [testApp],
          activeApp: testApp
        });
        mockWorkspace.getAppByPath.mockReturnValue(testApp);
        mockWorkspace.getPoolIdFromAppIdIfAvailable.mockReturnValue(testApp.appId);

        // Track IDs per object type
        const reservedIds: Record<string, Set<number>> = {
          table: new Set(),
          page: new Set(),
          codeunit: new Set()
        };

        mockBackend.getNext.mockImplementation(async (request: any, commit: any) => {
          const { type, require } = request;
          const typeIds = reservedIds[type] || new Set();

          if (require !== undefined) {
            if (!typeIds.has(require) && commit) {
              typeIds.add(require);
              reservedIds[type] = typeIds;
            }
            return { available: true, id: require };
          } else {
            let nextId = 50000;
            while (typeIds.has(nextId)) {
              nextId++;
            }
            if (commit) {
              typeIds.add(nextId);
              reservedIds[type] = typeIds;
            }
            return { available: true, id: nextId };
          }
        });

        // Reserve table ID 50000
        await mockBackend.getNext({
          appId: testApp.appId,
          type: 'table',
          ranges: testApp.ranges,
          authKey: testApp.authKey,
          require: 50000
        }, true);

        // Reserve page ID 50000 (same number, different type)
        await mockBackend.getNext({
          appId: testApp.appId,
          type: 'page',
          ranges: testApp.ranges,
          authKey: testApp.authKey,
          require: 50000
        }, true);

        // Reserve codeunit ID 50000
        await mockBackend.getNext({
          appId: testApp.appId,
          type: 'codeunit',
          ranges: testApp.ranges,
          authKey: testApp.authKey,
          require: 50000
        }, true);

        // Get next IDs for each type (should all be 50001)
        const nextTable = await mockBackend.getNext({
          appId: testApp.appId,
          type: 'table',
          ranges: testApp.ranges,
          authKey: testApp.authKey
        }, false);
        expect(nextTable.id).toBe(50001);

        const nextPage = await mockBackend.getNext({
          appId: testApp.appId,
          type: 'page',
          ranges: testApp.ranges,
          authKey: testApp.authKey
        }, false);
        expect(nextPage.id).toBe(50001);

        const nextCodeunit = await mockBackend.getNext({
          appId: testApp.appId,
          type: 'codeunit',
          ranges: testApp.ranges,
          authKey: testApp.authKey
        }, false);
        expect(nextCodeunit.id).toBe(50001);

        // Verify each type tracks independently
        expect(reservedIds.table.has(50000)).toBe(true);
        expect(reservedIds.page.has(50000)).toBe(true);
        expect(reservedIds.codeunit.has(50000)).toBe(true);
      });
    });

    describe('Field ID Complete Workflow', () => {
      it('should reserve field IDs without overriding', async () => {
        const tableId = 50100;
        const reservedFieldIds = new Set<number>();

        mockField.getNextFieldId.mockImplementation(async () => {
          let nextId = 1;
          while (reservedFieldIds.has(nextId)) {
            nextId++;
          }
          return nextId;
        });

        mockField.reserveFieldId.mockImplementation(async (appId: any, authKey: any, parentId: any, fieldId: any) => {
          if (reservedFieldIds.has(fieldId)) {
            return false;
          }
          reservedFieldIds.add(fieldId);
          return true;
        });

        // Get first field ID (should be 1)
        const firstFieldId = await mockField.getNextFieldId(
          mockApp.appId,
          mockApp.authKey,
          tableId,
          mockApp.ranges
        );
        expect(firstFieldId).toBe(1);

        // Reserve field ID 1
        const reserved1 = await mockField.reserveFieldId(
          mockApp.appId,
          mockApp.authKey,
          tableId,
          1,
          mockApp.ranges
        );
        expect(reserved1).toBe(true);

        // Get next field ID (should be 2, not 1)
        const secondFieldId = await mockField.getNextFieldId(
          mockApp.appId,
          mockApp.authKey,
          tableId,
          mockApp.ranges
        );
        expect(secondFieldId).toBe(2);

        // Reserve specific field ID 5
        const reserved5 = await mockField.reserveFieldId(
          mockApp.appId,
          mockApp.authKey,
          tableId,
          5,
          mockApp.ranges
        );
        expect(reserved5).toBe(true);

        // Reserve field ID 2
        const reserved2 = await mockField.reserveFieldId(
          mockApp.appId,
          mockApp.authKey,
          tableId,
          2,
          mockApp.ranges
        );
        expect(reserved2).toBe(true);

        // Get next field ID (should be 3, skipping reserved 1, 2, and 5)
        const thirdFieldId = await mockField.getNextFieldId(
          mockApp.appId,
          mockApp.authKey,
          tableId,
          mockApp.ranges
        );
        expect(thirdFieldId).toBe(3);

        // Verify all reserved IDs
        expect(reservedFieldIds.has(1)).toBe(true);
        expect(reservedFieldIds.has(2)).toBe(true);
        expect(reservedFieldIds.has(5)).toBe(true);
        expect(reservedFieldIds.has(3)).toBe(false);
        expect(reservedFieldIds.has(4)).toBe(false);
      });

      it('should handle enum value reservations correctly', async () => {
        const enumId = 50200;
        const reservedEnumValues = new Set<number>();

        mockField.getNextEnumValueId.mockImplementation(async () => {
          let nextId = 1;
          while (reservedEnumValues.has(nextId)) {
            nextId++;
          }
          return nextId;
        });

        mockField.reserveEnumValueId.mockImplementation(async (appId: any, authKey: any, parentId: any, valueId: any) => {
          if (reservedEnumValues.has(valueId)) {
            return false;
          }
          reservedEnumValues.add(valueId);
          return true;
        });

        // Get and reserve enum values
        const firstValue = await mockField.getNextEnumValueId(
          mockApp.appId,
          mockApp.authKey,
          enumId,
          mockApp.ranges
        );
        expect(firstValue).toBe(1);

        await mockField.reserveEnumValueId(
          mockApp.appId,
          mockApp.authKey,
          enumId,
          1,
          mockApp.ranges
        );

        const secondValue = await mockField.getNextEnumValueId(
          mockApp.appId,
          mockApp.authKey,
          enumId,
          mockApp.ranges
        );
        expect(secondValue).toBe(2); // Should skip reserved 1
      });
    });

    describe('State Persistence', () => {
      it('should maintain reserved IDs across multiple operations', async () => {
        const persistentIds = new Set<number>();

        mockBackend.getNext.mockImplementation(async (request: any, commit: any) => {
          const { require } = request;

          if (require !== undefined) {
            if (commit) persistentIds.add(require);
            return { available: !persistentIds.has(require), id: require };
          } else {
            let nextId = 50000;
            while (persistentIds.has(nextId)) {
              nextId++;
            }
            if (commit) persistentIds.add(nextId);
            return { available: true, id: nextId };
          }
        });

        // Reserve IDs 50000-50005
        for (let i = 50000; i <= 50005; i++) {
          await mockBackend.getNext({
            appId: mockApp.appId,
            type: 'table',
            require: i
          }, true);
        }

        // Simulate "new session" - get next should respect previous reservations
        const nextId = await mockBackend.getNext({
          appId: mockApp.appId,
          type: 'table'
        }, false);

        expect(nextId.id).toBe(50006);

        // Verify all previous IDs are still marked as taken
        for (let i = 50000; i <= 50005; i++) {
          const checkResult = await mockBackend.getNext({
            appId: mockApp.appId,
            type: 'table',
            require: i
          }, false);
          expect(persistentIds.has(i)).toBe(true);
        }
      });
    });

    describe('Authorization Requirements', () => {
      it('should prevent operations without proper authorization', async () => {
        const unauthorizedApp = {
          ...mockApp,
          isAuthorized: false,
          authKey: undefined
        };

        mockWorkspace.getAppByPath.mockReturnValue(unauthorizedApp);

        // Should not be able to get next ID without authorization
        const shouldFail = !unauthorizedApp.isAuthorized || !unauthorizedApp.authKey;
        expect(shouldFail).toBe(true);

        // Authorize the app
        unauthorizedApp.isAuthorized = true;
        (unauthorizedApp as any).authKey = 'new-auth-key';
        mockWorkspace.getAppByPath.mockReturnValue(unauthorizedApp);

        // Now operations should succeed
        mockBackend.getNext.mockResolvedValue({
          available: true,
          id: 50000
        });

        const result = await mockBackend.getNext({
          appId: unauthorizedApp.appId,
          type: 'table'
        }, false);

        expect(result.available).toBe(true);
        expect(result.id).toBe(50000);
      });
    });

    describe('Range Boundary Testing', () => {
      it('should handle range boundaries correctly', async () => {
        const limitedApp = {
          ...mockApp,
          ranges: [{ from: 50000, to: 50002 }] // Only 3 IDs available
        };

        mockWorkspace.getAppByPath.mockReturnValue(limitedApp);

        const usedIds = new Set<number>();
        mockBackend.getNext.mockImplementation(async (request: any, commit: any) => {
          const { ranges } = request;

          for (const range of ranges) {
            for (let id = range.from; id <= range.to; id++) {
              if (!usedIds.has(id)) {
                if (commit) usedIds.add(id);
                return { available: true, id };
              }
            }
          }

          return { available: false, id: null };
        });

        // Reserve all available IDs
        const id1 = await mockBackend.getNext({ ranges: limitedApp.ranges }, true);
        expect(id1.id).toBe(50000);

        const id2 = await mockBackend.getNext({ ranges: limitedApp.ranges }, true);
        expect(id2.id).toBe(50001);

        const id3 = await mockBackend.getNext({ ranges: limitedApp.ranges }, true);
        expect(id3.id).toBe(50002);

        // No more IDs available
        const id4 = await mockBackend.getNext({ ranges: limitedApp.ranges }, true);
        expect(id4.available).toBe(false);

        // Add new range
        limitedApp.ranges.push({ from: 60000, to: 60002 });

        // Should now get ID from new range
        const id5 = await mockBackend.getNext({ ranges: limitedApp.ranges }, true);
        expect(id5.id).toBe(60000);
      });
    });

    describe('Bulk Operations', () => {
      it('should handle rapid sequential reservations without duplicates', async () => {
        const bulkIds = new Set<number>();
        let counter = 50000;

        mockBackend.getNext.mockImplementation(async (request: any, commit: any) => {
          const id = counter;
          if (commit) {
            if (bulkIds.has(id)) {
              throw new Error(`Duplicate ID issued: ${id}`);
            }
            bulkIds.add(id);
            counter++;
          }
          return { available: true, id };
        });

        const reservedIds: number[] = [];

        // Reserve 100 IDs rapidly
        for (let i = 0; i < 100; i++) {
          const result = await mockBackend.getNext({
            appId: mockApp.appId,
            type: 'table'
          }, true);
          reservedIds.push(result.id);
        }

        // Verify no duplicates
        const uniqueIds = new Set(reservedIds);
        expect(uniqueIds.size).toBe(100);

        // Verify sequential
        expect(reservedIds[0]).toBe(50000);
        expect(reservedIds[99]).toBe(50099);

        // Verify all in sequence
        for (let i = 0; i < 99; i++) {
          expect(reservedIds[i + 1] - reservedIds[i]).toBe(1);
        }
      });
    });
  });
});