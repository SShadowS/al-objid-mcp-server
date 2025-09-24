# AL Object ID Ninja MCP Server - Test Plan

## Overview
This document outlines a comprehensive testing strategy for all MCP tools in the AL Object ID Ninja server. Tests are organized by tool category, dependency requirements, and testing priority.

## Test Framework Setup

### Technology Stack
- **Test Framework**: Jest (already configured)
- **MCP Client**: @modelcontextprotocol/sdk/client
- **Test Doubles**: Mock Backend Service, Mock File System
- **Coverage Target**: 90% code coverage

### Test Structure
```
mcp-server/
├── tests/
│   ├── unit/
│   │   ├── tools/           # Individual tool tests
│   │   ├── lib/             # Library component tests
│   │   └── mocks/           # Mock implementations
│   ├── integration/
│   │   ├── workflows/       # End-to-end workflow tests
│   │   └── scenarios/       # Real-world scenarios
│   └── fixtures/
│       ├── apps/            # Sample AL apps
│       └── data/            # Test data files
```

## Tool Categories & Test Requirements

### Category 1: Workspace Management Tools

#### 1.1 scan-workspace
**Priority**: Critical (all other tools depend on this)
**Test Cases**:
- ✅ Scan empty workspace
- ✅ Scan workspace with single AL app
- ✅ Scan workspace with multiple AL apps
- ✅ Scan workspace with nested AL apps
- ✅ Scan workspace with invalid app.json files
- ✅ Scan non-existent path
- ✅ Scan path without read permissions
- ✅ Verify app metadata extraction (ID, name, version, ranges)
- ✅ Verify authorization status detection
- ✅ Performance test with large workspace (100+ apps)

#### 1.2 set-active-app
**Priority**: Critical
**Test Cases**:
- ✅ Set active app after successful scan
- ✅ Set active app with forward slashes path
- ✅ Set active app with backslashes path
- ✅ Set active app with file:// URI
- ✅ Set active app with app.json path
- ❌ Set active app without prior scan (should fail)
- ❌ Set active app with non-existent path (should fail)
- ❌ Set active app not in workspace memory (should fail)
- ✅ Verify active app persistence across calls
- ✅ Switch between multiple active apps

#### 1.3 get-workspace-info
**Priority**: High
**Test Cases**:
- ✅ Get info with no workspace scanned
- ✅ Get info after scan but no active app
- ✅ Get info with active app set
- ✅ Verify complete workspace structure returned
- ✅ Verify active app indicator
- ✅ Performance with large workspace

#### 1.4 get-active-app
**Priority**: High
**Test Cases**:
- ✅ Get active app when set
- ❌ Get active app when none set (should fail gracefully)
- ✅ Verify complete app metadata returned

### Category 2: Authorization Tools

#### 2.1 check-authorization
**Priority**: High
**Dependencies**: Active app or appPath
**Test Cases**:
- ✅ Check authorized app
- ✅ Check unauthorized app
- ✅ Check with explicit appPath
- ✅ Check with active app
- ❌ Check without app context (should fail)
- ✅ Verify authorization details returned

#### 2.2 authorize-app
**Priority**: High
**Dependencies**: Active app or appPath
**Test Cases**:
- ✅ Authorize with valid key
- ❌ Authorize with invalid key (should fail)
- ❌ Authorize already authorized app
- ✅ Authorize with explicit appPath
- ✅ Authorize with active app
- ✅ Verify backend communication
- ✅ Handle network failures gracefully

### Category 3: Object ID Management Tools

#### 3.1 get-next-id
**Priority**: Critical
**Dependencies**: Active app, Authorization
**Test Cases**:
- ✅ Get next ID for each object type (table, page, codeunit, query, report, xmlport, enum)
- ✅ Get next ID with custom ranges
- ✅ Get next ID respecting app.json ranges
- ✅ Get next ID respecting .objidconfig ranges
- ❌ Get next ID for unauthorized app (should fail)
- ❌ Get next ID with exhausted ranges (should fail)
- ✅ Concurrent get-next-id calls (race condition test)
- ✅ Performance test (1000 sequential calls)

#### 3.2 sync-ids
**Priority**: Critical
**Dependencies**: Active app, Authorization
**Test Cases**:
- ✅ Sync with no changes
- ✅ Sync with new IDs assigned
- ✅ Sync with deleted objects
- ✅ Sync with modified objects
- ❌ Sync unauthorized app (should fail)
- ✅ Handle backend failures with retry
- ✅ Verify conflict detection
- ✅ Batch sync performance (1000+ objects)

#### 3.3 get-consumption-report
**Priority**: Medium
**Dependencies**: Active app, Authorization
**Test Cases**:
- ✅ Get report for app with no consumption
- ✅ Get report for app with partial consumption
- ✅ Get report for app with full consumption
- ✅ Verify report format and calculations
- ✅ Performance with large consumption data

### Category 4: Collision Detection Tools

#### 4.1 check-collision
**Priority**: High
**Dependencies**: Active app or appPath
**Test Cases**:
- ✅ Check ID with no collision
- ✅ Check ID with local collision
- ✅ Check ID with backend collision
- ✅ Check ID with partner app collision
- ✅ Check across all object types
- ✅ Verify collision details returned
- ✅ Performance with large collision dataset

#### 4.2 check-range-overlaps
**Priority**: Medium
**Test Cases**:
- ✅ Check non-overlapping ranges
- ✅ Check partially overlapping ranges
- ✅ Check fully overlapping ranges
- ✅ Check nested ranges
- ✅ Check with multiple range sets
- ✅ Validate range format validation

### Category 5: Field Management Tools

#### 5.1 get-next-field-id
**Priority**: Medium
**Dependencies**: Active app, Authorization
**Test Cases**:
- ✅ Get next field ID for table
- ✅ Get next field ID for table extension
- ✅ Get next field ID respecting reserved ranges
- ❌ Get next field ID for non-table object (should fail)
- ✅ Handle field ID exhaustion
- ✅ Concurrent field ID assignment

#### 5.2 get-next-enum-value-id
**Priority**: Medium
**Dependencies**: Active app, Authorization
**Test Cases**:
- ✅ Get next enum value ID
- ✅ Get next enum value for enum extension
- ✅ Respect enum value ranges
- ✅ Handle value ID conflicts
- ✅ Sequential value assignment

### Category 6: Assignment Tools

#### 6.1 assign-ids
**Priority**: High
**Dependencies**: Active app or appPath
**Test Cases**:
- ✅ Assign single ID
- ✅ Assign multiple IDs (batch)
- ✅ Assign with collision checking enabled
- ✅ Assign with collision checking disabled
- ✅ Assign with alternative suggestions
- ✅ Interactive assignment flow simulation
- ✅ Handle assignment conflicts
- ✅ Rollback on partial failure

#### 6.2 batch-assign
**Priority**: Medium
**Dependencies**: Active app or appPath
**Test Cases**:
- ✅ Batch assign homogeneous objects
- ✅ Batch assign heterogeneous objects
- ✅ Batch assign with range constraints
- ✅ Atomic batch operations
- ✅ Performance with large batches (100+ objects)

#### 6.3 reserve-range
**Priority**: Low
**Dependencies**: Active app or appPath
**Test Cases**:
- ✅ Reserve available range
- ❌ Reserve overlapping range (should fail)
- ✅ Reserve with authorization
- ✅ Range persistence verification
- ✅ Range release functionality

#### 6.4 get-suggestions
**Priority**: Low
**Dependencies**: Active app or appPath
**Test Cases**:
- ✅ Get suggestions for available IDs
- ✅ Get suggestions avoiding collisions
- ✅ Get suggestions respecting patterns
- ✅ Suggestion quality metrics

### Category 7: Polling & Real-time Tools

#### 7.1 start-polling
**Priority**: Medium
**Test Cases**:
- ✅ Start polling with default interval
- ✅ Start polling with custom interval
- ❌ Start polling when already active (should fail)
- ✅ Verify WebSocket connection
- ✅ Handle connection drops and reconnection

#### 7.2 stop-polling
**Priority**: Medium
**Test Cases**:
- ✅ Stop active polling
- ❌ Stop when not polling (should handle gracefully)
- ✅ Verify cleanup of resources
- ✅ Verify no memory leaks

#### 7.3 get-polling-status
**Priority**: Low
**Test Cases**:
- ✅ Get status when polling active
- ✅ Get status when polling inactive
- ✅ Verify status details accuracy
- ✅ Include connection health metrics

### Category 8: Configuration Tools

#### 8.1 save-preferences
**Priority**: Low
**Test Cases**:
- ✅ Save new preferences
- ✅ Update existing preferences
- ✅ Validate preference schema
- ✅ Persistence across sessions
- ✅ Handle invalid preference data

#### 8.2 get-preferences
**Priority**: Low
**Test Cases**:
- ✅ Get saved preferences
- ✅ Get default preferences when none saved
- ✅ Merge user and default preferences
- ✅ Version migration handling

#### 8.3 export-config
**Priority**: Low
**Test Cases**:
- ✅ Export complete configuration
- ✅ Export partial configuration
- ✅ Export with sensitive data sanitization
- ✅ Verify export format (JSON/YAML)
- ✅ Handle large configurations

#### 8.4 import-config
**Priority**: Low
**Test Cases**:
- ✅ Import valid configuration
- ❌ Import invalid configuration (should fail)
- ✅ Import with merge strategy
- ✅ Import with replace strategy
- ✅ Handle version mismatches
- ✅ Validate and sanitize imported data

### Category 9: Statistics & History Tools

#### 9.1 get-statistics
**Priority**: Low
**Test Cases**:
- ✅ Get global statistics
- ✅ Get app-specific statistics
- ✅ Get time-range filtered statistics
- ✅ Verify calculation accuracy
- ✅ Performance with large datasets

#### 9.2 get-assignment-history
**Priority**: Low
**Test Cases**:
- ✅ Get complete history
- ✅ Get filtered history by date
- ✅ Get filtered history by object type
- ✅ Get filtered history by user
- ✅ Pagination for large histories
- ✅ History export functionality

## Test Implementation Priority

### Phase 1: Critical Path (Week 1)
1. scan-workspace
2. set-active-app
3. get-next-id
4. sync-ids
5. Basic integration test workflow

### Phase 2: Core Functionality (Week 2)
1. check-authorization
2. authorize-app
3. assign-ids
4. check-collision
5. get-workspace-info

### Phase 3: Extended Features (Week 3)
1. Field management tools
2. Polling tools
3. Batch operations
4. Collision detection enhancements

### Phase 4: Configuration & Utilities (Week 4)
1. Configuration tools
2. Statistics tools
3. History tools
4. Performance test suite

## Mock Strategy

### Backend Service Mock
```typescript
class MockBackendService {
  // Simulate API responses
  // Control failure scenarios
  // Track call history for assertions
}
```

### File System Mock
```typescript
class MockFileSystem {
  // Virtual file system for tests
  // Simulate AL apps structure
  // Control permission scenarios
}
```

### WebSocket Mock
```typescript
class MockWebSocket {
  // Simulate real-time events
  // Control connection states
  // Trigger collision notifications
}
```

## Integration Test Scenarios

### Scenario 1: New Developer Onboarding
1. Scan workspace
2. Set active app
3. Check authorization
4. Authorize app
5. Get first object ID
6. Sync to backend

### Scenario 2: Collaborative Development
1. Multiple developers working on same app
2. Real-time collision detection
3. ID assignment coordination
4. Conflict resolution

### Scenario 3: Large-Scale Migration
1. Batch import existing objects
2. Detect and resolve collisions
3. Reserve ranges for future use
4. Generate migration report

## Performance Benchmarks

### Target Metrics
- Tool response time: < 100ms (local operations)
- Tool response time: < 500ms (backend operations)
- Memory usage: < 50MB for typical workspace
- CPU usage: < 5% idle, < 25% active
- Concurrent operations: Support 10+ simultaneous clients

### Load Testing
- 1000 AL apps in workspace
- 10000 objects per app
- 100 concurrent MCP clients
- 1000 requests per minute

## Coverage Requirements

### Unit Test Coverage
- Line coverage: ≥ 90%
- Branch coverage: ≥ 85%
- Function coverage: ≥ 95%

### Integration Test Coverage
- All critical paths: 100%
- All tool combinations: ≥ 80%
- Error scenarios: ≥ 90%

## CI/CD Integration

### Pre-commit Hooks
- Run unit tests for changed files
- Lint and format check
- Quick smoke tests

### Pull Request Checks
- Full unit test suite
- Integration tests
- Coverage report
- Performance regression tests

### Release Pipeline
- Full test suite
- Load testing
- Security scanning
- Compatibility testing

## Test Data Management

### Fixtures Structure
```
fixtures/
├── apps/
│   ├── simple-app/
│   │   ├── app.json
│   │   └── .objidconfig
│   ├── complex-app/
│   │   ├── app.json
│   │   ├── .objidconfig
│   │   └── src/
│   └── invalid-app/
│       └── app.json (malformed)
├── configs/
│   ├── default.json
│   ├── authorized.json
│   └── complex.json
└── responses/
    ├── backend/
    │   ├── success.json
    │   ├── error.json
    │   └── timeout.json
    └── websocket/
        ├── collision.json
        └── update.json
```

## Testing Commands

```bash
# Run all tests
npm test

# Run specific category
npm test -- --testPathPattern=workspace
npm test -- --testPathPattern=auth
npm test -- --testPathPattern=object-id

# Run with coverage
npm test -- --coverage

# Run integration tests only
npm test -- --testPathPattern=integration

# Run performance tests
npm test -- --testPathPattern=performance

# Watch mode for development
npm test -- --watch

# Debug specific test
npm test -- --testNamePattern="scan-workspace"
```

## Success Criteria

1. All tools have comprehensive test coverage
2. All critical workflows are integration tested
3. Performance benchmarks are met
4. No regressions in existing functionality
5. Clear test documentation and examples
6. Tests run in < 2 minutes locally
7. Tests are maintainable and well-organized

## Next Steps

1. Set up test framework and structure
2. Create mock implementations
3. Implement Phase 1 tests
4. Set up CI/CD pipeline
5. Create test data fixtures
6. Document test patterns and best practices