# Testing Guide for AL Object ID Ninja MCP Server

## Prerequisites

1. Install dependencies:
```bash
cd mcp-server
npm install
```

2. Build the TypeScript code:
```bash
npm run build
```

## Running Tests

### Quick Start

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (re-runs on file changes)
npm run test:watch
```

### Running Specific Test Suites

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Specific tool category tests
npm run test:workspace    # Workspace management tools
npm run test:auth        # Authorization tools
npm run test:ids         # Object ID management tools
npm run test:collision   # Collision detection tools
npm run test:workflow    # Integration workflows
```

### Running Individual Test Files

```bash
# Run a specific test file
npx jest tests/unit/workspace-tools.test.ts

# Run tests matching a pattern
npx jest --testNamePattern="scan-workspace"

# Run tests for a specific describe block
npx jest --testNamePattern="Authorization Tools"
```

## Test Options

### Verbose Output
Shows detailed test results:
```bash
npm run test:verbose
```

### Debug Mode
Run tests with Node debugger:
```bash
npm run test:debug
```
Then open `chrome://inspect` in Chrome and click "inspect" to debug.

### Coverage Report
Generate and view coverage report:
```bash
npm run test:coverage
# Coverage report will be in coverage/index.html
```

### CI Mode
Optimized for continuous integration:
```bash
npm run test:ci
```

### Watch Mode
Automatically re-run tests when files change:
```bash
npm run test:watch
```

## Test Structure

```
mcp-server/
├── tests/
│   ├── unit/                    # Unit tests
│   │   ├── workspace-tools.test.ts   # 28 tests
│   │   ├── authorization-tools.test.ts # 19 tests
│   │   ├── object-id-tools.test.ts   # 27 tests
│   │   └── collision-tools.test.ts   # 21 tests
│   ├── integration/              # Integration tests
│   │   └── workflow.test.ts     # 10 workflow scenarios
│   ├── mocks/                   # Mock implementations
│   │   ├── MockBackendService.ts
│   │   └── MockWorkspaceManager.ts
│   └── setup.ts                 # Jest setup file
├── jest.config.js               # Jest configuration
└── package.json                 # Test scripts
```

## Test Categories

### Unit Tests (95 tests)
- **Workspace Management** (28 tests)
  - scan-workspace
  - set-active-app
  - get-workspace-info
  - get-active-app

- **Authorization** (19 tests)
  - check-authorization
  - authorize-app

- **Object ID Management** (27 tests)
  - get-next-id
  - sync-ids
  - get-consumption-report

- **Collision Detection** (21 tests)
  - check-collision
  - check-range-overlaps

### Integration Tests (10 scenarios)
- New Developer Onboarding
- Collaborative Development
- Large-Scale Migration
- Continuous Development Workflow
- Performance & Stress Testing

## Environment Variables

Control test behavior with environment variables:

```bash
# Show console output during tests
SHOW_TEST_LOGS=true npm test

# Run in CI mode
CI=true npm test

# Set custom timeout
JEST_TIMEOUT=60000 npm test
```

## Coverage Targets

The project aims for:
- Line coverage: ≥ 85%
- Branch coverage: ≥ 80%
- Function coverage: ≥ 85%
- Statement coverage: ≥ 85%

View current coverage:
```bash
npm run test:coverage
```

## Writing New Tests

### Unit Test Template

```typescript
import { MockBackendService } from '../mocks/MockBackendService';
import { MockWorkspaceManager } from '../mocks/MockWorkspaceManager';

describe('Tool Category', () => {
  let backend: MockBackendService;
  let workspace: MockWorkspaceManager;

  beforeEach(() => {
    backend = new MockBackendService();
    workspace = new MockWorkspaceManager();
  });

  afterEach(() => {
    backend.reset();
    workspace.reset();
  });

  describe('specific-tool', () => {
    it('should handle success case', async () => {
      // Arrange
      const input = { /* ... */ };

      // Act
      const result = await backend.someMethod(input);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle error case', async () => {
      // Arrange
      backend.setConfig({ failAuth: true });

      // Act & Assert
      await expect(backend.someMethod())
        .rejects.toThrow('Expected error');
    });
  });
});
```

### Custom Matchers

The test setup includes custom Jest matchers:

```typescript
// Check if a number is in range
expect(50005).toBeInRange(50000, 50099);
```

### Test Utilities

Global test utilities are available:

```typescript
// Create mock app.json
const appJson = global.testUtils.createMockAppJson(
  'app-id',
  'App Name',
  [{ from: 50000, to: 50999 }]
);

// Create ID range
const range = global.testUtils.createRange(50000, 50999);

// Wait for async operations
await global.testUtils.wait(100);
```

## Troubleshooting

### Tests Failing

1. Ensure TypeScript is built:
```bash
npm run build
```

2. Clear Jest cache:
```bash
npx jest --clearCache
```

3. Check Node version (requires Node 14+):
```bash
node --version
```

### Timeout Issues

Increase timeout for slow tests:
```bash
# For specific test
jest --testTimeout=30000

# Globally in jest.config.js
testTimeout: 30000
```

### Coverage Not Generated

Ensure coverage directory exists:
```bash
mkdir coverage
npm run test:coverage
```

## Continuous Integration

For CI/CD pipelines, use:

```bash
# Run tests with coverage in CI mode
npm run test:ci

# Generate coverage reports for CI
npm run test:coverage -- --coverageReporters=text-lcov > coverage.lcov
```

## Performance Testing

Run performance benchmarks:
```bash
npm run test:integration -- --testNamePattern="Performance"
```

Expected performance targets:
- Tool response time: < 100ms (local operations)
- Tool response time: < 500ms (backend operations)
- Concurrent operations: 10+ simultaneous clients
- Batch operations: 1000+ objects

## Next Steps

1. Run the full test suite to verify everything works:
```bash
npm test
```

2. Check coverage to identify untested code:
```bash
npm run test:coverage
```

3. Run specific tool tests during development:
```bash
npm run test:watch -- workspace-tools
```

4. Add new tests as you implement features
5. Keep tests fast and focused
6. Use mocks to avoid external dependencies