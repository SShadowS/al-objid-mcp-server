# Lite Mode Tools - Developer Implementation Guide

## Overview

This guide details the implementation of enhanced lite mode tools for the AL Object ID Ninja MCP server. The design separates ID querying from reservation, providing clear and explicit control while maintaining simplicity for lite mode users.

## Architecture Decision

### Current State
- Lite mode currently exposes `get-next-id` which only queries (GET request) without reserving
- The VS Code extension uses `commit=false` for queries and `commit=true` for reservations
- Users in lite mode cannot reserve IDs, leading to potential conflicts

### Proposed Solution
Two separate tools with clear responsibilities:
1. **`get-next-id`** - Query available IDs (enhanced to support fields)
2. **`reserve-id`** - Reserve specific IDs for use

## Tool Specifications

### 1. Enhanced `get-next-id` Tool

#### Purpose
Query the next available ID without reserving it. Supports both object IDs and field/enum value IDs.

#### Schema
```typescript
{
  name: "get-next-id",
  description: "Get the next available ID for objects or fields",
  category: 'core',
  inputSchema: {
    type: "object",
    properties: {
      objectType: {
        type: "string",
        enum: ["table", "page", "report", "codeunit", "query", "xmlport", "enum", "field"],
        description: "Type of AL object or 'field' for field IDs"
      },
      parentObjectId: {
        type: "number",
        description: "For field IDs: the table ID. For enum values: the enum ID"
      },
      isExtension: {
        type: "boolean",
        description: "Whether this is for a table/enum extension"
      },
      ranges: {
        type: "array",
        items: {
          type: "object",
          properties: {
            from: { type: "number" },
            to: { type: "number" }
          }
        },
        description: "Optional custom ranges to search within"
      },
      appPath: {
        type: "string",
        description: "Path to the AL app (optional, uses active app if not provided)"
      }
    },
    required: ["objectType"]
  }
}
```

#### Implementation Logic
```typescript
private async handleGetNextId(args: any): Promise<ToolCallResponse> {
  const app = await this.getAppFromPath(args.appPath);
  if (!app) {
    return { content: [{ type: "text", text: "No AL app found" }], isError: true };
  }

  if (!app.isAuthorized || !app.authKey) {
    return { content: [{ type: "text", text: "App not authorized" }], isError: true };
  }

  // Determine if this is a field/enum value request
  if (args.parentObjectId) {
    if (args.objectType === 'field' || args.objectType === 'table') {
      // Get field ID
      const fieldId = await this.field.getNextFieldId(
        app.appId,
        app.authKey,
        args.parentObjectId,
        args.isExtension || false
      );
      return {
        content: [{
          type: "text",
          text: `Next available field ID for table ${args.parentObjectId}: ${fieldId}`
        }]
      };
    } else if (args.objectType === 'enum') {
      // Get enum value ID
      const enumValueId = await this.field.getNextEnumValueId(
        app.appId,
        app.authKey,
        args.parentObjectId,
        args.isExtension || false
      );
      return {
        content: [{
          type: "text",
          text: `Next available enum value for enum ${args.parentObjectId}: ${enumValueId}`
        }]
      };
    }
  }

  // Standard object ID request (query only, no commit)
  const objectType = args.objectType as ALObjectType;
  const ranges = args.ranges || app.ranges || [{ from: 50000, to: 99999 }];
  const appId = this.workspace.getPoolIdFromAppIdIfAvailable(app.appId);

  const request = {
    appId,
    type: objectType,
    ranges,
    authKey: app.authKey,
    perRange: false
  };

  // Query without committing (GET request)
  const result = await this.backend.getNext(request, false);

  if (result && result.available) {
    const id = Array.isArray(result.id) ? result.id[0] : result.id;

    // Check for potential collisions
    const collision = await this.collision.checkCollision(objectType, id, app);

    if (collision) {
      return {
        content: [{
          type: "text",
          text: `Next available ${objectType} ID: ${id}\n⚠️ Warning: Potential collision with ${collision.apps.map(a => a.appName).join(', ')}\nUse 'reserve-id' to claim this ID.`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Next available ${objectType} ID: ${id}\nUse 'reserve-id' to claim this ID.`
      }]
    };
  }

  return {
    content: [{ type: "text", text: `No available ${objectType} IDs found in ranges` }],
    isError: true
  };
}
```

### 2. New `reserve-id` Tool

#### Purpose
Reserve a specific ID that was previously queried or chosen by the user.

#### Schema
```typescript
{
  name: "reserve-id",
  description: "Reserve a specific ID for use",
  category: 'core',
  inputSchema: {
    type: "object",
    properties: {
      objectType: {
        type: "string",
        enum: ["table", "page", "report", "codeunit", "query", "xmlport", "enum", "field"],
        description: "Type of AL object or 'field' for field IDs"
      },
      id: {
        type: "number",
        description: "The specific ID to reserve"
      },
      parentObjectId: {
        type: "number",
        description: "For field IDs: the table ID. For enum values: the enum ID"
      },
      isExtension: {
        type: "boolean",
        description: "Whether this is for a table/enum extension"
      },
      appPath: {
        type: "string",
        description: "Path to the AL app (optional, uses active app if not provided)"
      }
    },
    required: ["objectType", "id"]
  }
}
```

#### Implementation Logic
```typescript
private async handleReserveId(args: any): Promise<ToolCallResponse> {
  const app = await this.getAppFromPath(args.appPath);
  if (!app) {
    return { content: [{ type: "text", text: "No AL app found" }], isError: true };
  }

  if (!app.isAuthorized || !app.authKey) {
    return { content: [{ type: "text", text: "App not authorized" }], isError: true };
  }

  // Handle field/enum value reservation
  if (args.parentObjectId) {
    if (args.objectType === 'field' || args.objectType === 'table') {
      // Reserve field ID
      const success = await this.field.reserveFieldId(
        app.appId,
        app.authKey,
        args.parentObjectId,
        args.id,
        args.isExtension || false
      );

      if (success) {
        return {
          content: [{
            type: "text",
            text: `✓ Reserved field ID ${args.id} for table ${args.parentObjectId}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `✗ Failed to reserve field ID ${args.id} - may already be in use`
          }],
          isError: true
        };
      }
    } else if (args.objectType === 'enum') {
      // Reserve enum value
      const success = await this.field.reserveEnumValueId(
        app.appId,
        app.authKey,
        args.parentObjectId,
        args.id,
        args.isExtension || false
      );

      if (success) {
        return {
          content: [{
            type: "text",
            text: `✓ Reserved enum value ${args.id} for enum ${args.parentObjectId}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `✗ Failed to reserve enum value ${args.id} - may already be in use`
          }],
          isError: true
        };
      }
    }
  }

  // Standard object ID reservation
  const objectType = args.objectType as ALObjectType;
  const ranges = app.ranges || [{ from: 50000, to: 99999 }];
  const appId = this.workspace.getPoolIdFromAppIdIfAvailable(app.appId);

  // Validate ID is within allowed ranges
  const inRange = ranges.some(r => args.id >= r.from && args.id <= r.to);
  if (!inRange) {
    return {
      content: [{
        type: "text",
        text: `✗ ID ${args.id} is outside allowed ranges`
      }],
      isError: true
    };
  }

  const request = {
    appId,
    type: objectType,
    ranges,
    authKey: app.authKey,
    perRange: false,
    require: args.id  // Specific ID to reserve
  };

  // Commit the reservation (POST request)
  const result = await this.backend.getNext(request, true);

  if (result && result.available) {
    const reservedId = Array.isArray(result.id) ? result.id[0] : result.id;

    if (reservedId === args.id) {
      // Successfully reserved the requested ID
      await this.assignment.trackAssignment(app, objectType, args.id);

      return {
        content: [{
          type: "text",
          text: `✓ Successfully reserved ${objectType} ID: ${args.id}`
        }]
      };
    } else {
      // Different ID was returned - original was taken
      return {
        content: [{
          type: "text",
          text: `✗ ID ${args.id} is already taken. Next available: ${reservedId}\nUse 'get-next-id' to find another available ID.`
        }],
        isError: true
      };
    }
  }

  return {
    content: [{
      type: "text",
      text: `✗ Failed to reserve ${objectType} ID ${args.id}`
    }],
    isError: true
  };
}
```

## Integration Steps

### 1. Update Tool Definitions
Add the new `reserve-id` tool to `toolDefinitions.ts` and enhance the existing `get-next-id` definition.

### 2. Update Tool Filter
```typescript
// src/tools/toolFilter.ts
const LITE_MODE_TOOLS = [
  'scan-workspace',     // Essential for discovering AL apps
  'set-active-app',     // Required to work with a specific app
  'get-next-id',        // Query available IDs (enhanced)
  'reserve-id'          // Reserve specific IDs (new)
];
```

### 3. Add Handler Methods
Implement both `handleGetNextId` (enhanced) and `handleReserveId` (new) in `server.ts`.

### 4. Backend Service Updates
Ensure `BackendService` properly handles the `commit` parameter and `require` field for reservations.

### 5. Field Manager Extensions
Add reservation methods to `FieldManager`:
- `reserveFieldId(appId, authKey, tableId, fieldId, isExtension)`
- `reserveEnumValueId(appId, authKey, enumId, valueId, isExtension)`

## Usage Examples

### Basic Object ID Flow
```typescript
// 1. Query next available table ID
const result1 = await callTool('get-next-id', {
  objectType: 'table'
});
// Returns: "Next available table ID: 50100"

// 2. Reserve the ID
const result2 = await callTool('reserve-id', {
  objectType: 'table',
  id: 50100
});
// Returns: "✓ Successfully reserved table ID: 50100"
```

### Field ID Flow
```typescript
// 1. Query next field ID for table 50100
const result1 = await callTool('get-next-id', {
  objectType: 'field',
  parentObjectId: 50100
});
// Returns: "Next available field ID for table 50100: 10"

// 2. Reserve the field ID
const result2 = await callTool('reserve-id', {
  objectType: 'field',
  parentObjectId: 50100,
  id: 10
});
// Returns: "✓ Reserved field ID 10 for table 50100"
```

### Handling Conflicts
```typescript
// 1. Try to reserve an ID that's already taken
const result = await callTool('reserve-id', {
  objectType: 'page',
  id: 50000
});
// Returns: "✗ ID 50000 is already taken. Next available: 50001"

// 2. Query for a new suggestion
const result2 = await callTool('get-next-id', {
  objectType: 'page'
});
// Returns: "Next available page ID: 50001"
```

## Testing Guidelines

### Unit Tests
```typescript
describe('Lite Mode Tools', () => {
  describe('get-next-id', () => {
    it('should query object ID without reserving', async () => {
      // Mock backend.getNext to verify commit=false
      const spy = jest.spyOn(backend, 'getNext');
      await handleGetNextId({ objectType: 'table' });
      expect(spy).toHaveBeenCalledWith(expect.any(Object), false);
    });

    it('should handle field ID queries with parentObjectId', async () => {
      const result = await handleGetNextId({
        objectType: 'field',
        parentObjectId: 50100
      });
      expect(result.content[0].text).toContain('field ID for table 50100');
    });
  });

  describe('reserve-id', () => {
    it('should reserve ID with commit=true', async () => {
      const spy = jest.spyOn(backend, 'getNext');
      await handleReserveId({ objectType: 'table', id: 50100 });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ require: 50100 }),
        true
      );
    });

    it('should validate ID is within ranges', async () => {
      const result = await handleReserveId({
        objectType: 'table',
        id: 999999  // Outside typical range
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('outside allowed ranges');
    });
  });
});
```

### Integration Tests
1. Test complete flow: scan → set active → get-next → reserve
2. Test conflict scenarios where IDs become unavailable between query and reserve
3. Test field ID flows with both tables and enums
4. Test extension scenarios with isExtension flag

### Manual Testing Checklist
- [ ] Verify `get-next-id` returns available IDs without reserving
- [ ] Verify `reserve-id` successfully claims IDs
- [ ] Test reservation failures when ID already taken
- [ ] Test field ID queries and reservations
- [ ] Test enum value ID queries and reservations
- [ ] Verify proper error messages for unauthorized apps
- [ ] Test with custom ranges
- [ ] Verify collision warnings appear in get-next-id

## Migration Path

### Phase 1: Implementation
1. Implement enhanced `get-next-id` with backward compatibility
2. Add new `reserve-id` tool
3. Update lite mode tool list

### Phase 2: Testing
1. Run comprehensive test suite
2. Manual testing of all scenarios
3. Performance testing with concurrent reservations

### Phase 3: Documentation
1. Update user documentation
2. Create migration guide for existing lite mode users
3. Add examples to README

### Phase 4: Release
1. Version bump to indicate new functionality
2. Release notes highlighting the new two-tool approach
3. Monitor for user feedback and issues

## Benefits of This Approach

1. **Clarity**: Clear separation between querying and reserving
2. **Control**: Users explicitly choose when to reserve IDs
3. **Flexibility**: Can query multiple options before deciding
4. **Unified Interface**: Single tool handles both objects and fields
5. **Safety**: No accidental reservations
6. **Compatibility**: Maintains existing tool behavior while adding new capabilities

## Potential Future Enhancements

1. **Batch Operations**: Reserve multiple IDs in one call
2. **Range Reservation**: Reserve a contiguous range of IDs
3. **Undo/Release**: Tool to release previously reserved IDs
4. **Suggestions**: Get multiple ID suggestions at once
5. **Smart Defaults**: Auto-detect field context from recent operations

## Conclusion

This two-tool approach provides a clean, intuitive interface for lite mode users while maintaining the full power of the ID management system. The separation of concerns makes the system more predictable and gives users explicit control over their ID reservations.