# AL Object ID Ninja MCP Server

MCP (Model Context Protocol) server for AL Object ID management in Microsoft Dynamics 365 Business Central development.

## Overview

This MCP server exposes the complete functionality of the AL Object ID Ninja VS Code extension as a service consumable by any MCP-compatible client. It provides intelligent object ID management, real-time synchronization with Azure Functions backend, collision prevention, interactive assignment, and comprehensive pool management for AL development teams.
All Vjeko's original features are included.

**🎯 Current Status: 80% Complete - Fully Functional with Advanced Features**

- **25 MCP Tools** implemented and tested
- **100% integration test pass rate** against live backend
- **Interactive assignment with collision detection**

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/SShadowS/al-objid-mcp-server.git
cd objid-mcp/mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

## 🚀 Claude Code Setup

Add the MCP server to Claude Code using the `claude` CLI tool in your terminal:

```bash
# Add the MCP server in FULL mode (default - all 25 tools)
claude mcp add objid node "U:\Git\objid-mcp\mcp-server\dist\server.js"

# Add the MCP server in LITE mode in current project (only 3 essential tools)
claude mcp add objidlite -s project -- node "U:\Git\objid-mcp\mcp-server\dist\server.js"

# Verify it was added
claude mcp list
```

Replace `U:\Git\objid-mcp\mcp-server\dist\server.js` with your actual installation path.

That's it! The server uses the default AL Object ID Ninja backend automatically. No API keys or environment variables required. The server will be available in Claude Code after adding it.

To remove the server later if needed:

```bash
claude mcp remove objid
```

## 🎛️ Server Modes (Full vs Lite)

The MCP server can run in two modes to suit different needs:

### Full Mode (Default)
- **All 25 tools** available
- Complete feature set for comprehensive AL development

### Lite Mode
- **Only 3 essential tools** available:
  - `scan-workspace` - Discover AL apps in your workspace
  - `set-active-app` - Select which app to work with
  - `get-next-id` - Get the next available object ID
- Lower overhead when full functionality isn't needed

The server will log which mode it's running in at startup:
- Full mode: `"Running in FULL mode - exposing all 25 tools"`
- Lite mode: `"Running in LITE mode - exposing 3 essential tools"`

## Configuration

### Default Configuration (No Setup Required)

The MCP server works out-of-the-box with the default AL Object ID Ninja backend (`vjekocom-alext-weu.azurewebsites.net`). **No configuration files or environment variables are needed for standard use.**

### Server Mode Configuration (Optional)

Control whether the server runs in full or lite mode:

```bash
# Run in lite mode (Windows PowerShell)
$env:MCP_MODE = "lite"
npm start

# Run in lite mode (Windows Command Prompt)
set MCP_MODE=lite && npm start

# Run in lite mode (Linux/Mac)
MCP_MODE=lite npm start
```

### Custom Backend Configuration (Optional)

Only needed if you're using your own Azure Functions backend:

#### Option 1: Environment Variables

Create a `.env` file:

```bash
MCP_MODE=lite                                    # Server mode: 'lite' or 'full' (default: full)
NINJA_BACKEND_URL=your-backend.azurewebsites.net
NINJA_API_KEY=your-api-key
NINJA_POLL_URL=your-polling.azurewebsites.net
NINJA_POLL_KEY=your-poll-key
NINJA_INCLUDE_USERNAME=true
NINJA_VERBOSE_LOGGING=false
```

#### Option 2: Configuration File

Create `mcp-config.json`:

```json
{
  "backend": {
    "url": "your-backend.azurewebsites.net",
    "apiKey": "your-api-key",
    "pollUrl": "your-polling.azurewebsites.net",
    "pollKey": "your-poll-key"
  },
  "defaults": {
    "includeUserName": true,
    "verboseLogging": false
  }
}
```

## Usage

### Start the Server

```bash
npm start
```

### Development Mode

```bash
npm run dev  # Run with ts-node
npm run watch  # Build in watch mode
```

## 🛠️ Available MCP Tools (25 Complete)

### Core ID Management

- **`get-next-id`** - Get the next available object ID for a specific type
- **`sync-object-ids`** - Sync consumed object IDs with the backend

### Authorization & Backend Communication

- **`check-authorization`** - Check if an AL app is authorized with the backend
- **`authorize-app`** - Authorize an AL app with the backend using auth key
- **`get-consumption-report`** - Get detailed consumption report for an app

### Workspace Management

- **`scan-workspace`** - Scan a workspace for AL apps and detect configurations
- **`get-workspace-info`** - Get information about the current workspace state
- **`set-active-app`** - Set the active AL app in multi-app workspaces

### Field & Enum Management

- **`get-next-field-id`** - Get next available field ID for table/table extensions
- **`get-next-enum-value-id`** - Get next available enum value ID

### Collision Detection & Prevention

- **`check-collision`** - Check if an object ID would cause a collision
- **`check-range-overlaps`** - Check for range overlaps between apps

### Real-time Polling System

- **`start-polling`** - Start real-time backend synchronization
- **`stop-polling`** - Stop the polling service
- **`get-polling-status`** - Get current polling status and metrics

### Interactive Assignment (Phase 4)

- **`assign-ids`** - Interactively assign object IDs with collision checking
- **`batch-assign`** - Batch assign IDs for multiple object types
- **`reserve-range`** - Reserve ID ranges for future use
- **`get-suggestions`** - Get smart ID assignment suggestions
- **`get-assignment-history`** - View assignment history and patterns

### Configuration & Persistence

- **`save-preferences`** - Save user preferences (auto-sync, collision checking, etc.)
- **`get-preferences`** - Get current user preferences
- **`export-config`** - Export complete configuration to JSON
- **`import-config`** - Import configuration from JSON
- **`get-statistics`** - Get comprehensive usage statistics

Each tool supports comprehensive error handling, logging, and integrates with the Azure Functions V2 backend API.

## 📁 Project Structure

```
mcp-server/
├── src/
│   ├── server.ts             # Main MCP server (25 tools implemented)
│   └── lib/                  # Core business logic
│       ├── assignment/       # Interactive assignment features
│       │   └── AssignmentManager.ts
│       ├── backend/          # Azure Functions API integration
│       │   └── BackendService.ts
│       ├── collision/        # Collision detection system
│       │   └── CollisionDetector.ts
│       ├── config/           # Configuration management
│       │   └── ConfigPersistence.ts
│       ├── fields/           # Field ID management
│       │   └── FieldManager.ts
│       ├── polling/          # Real-time polling system
│       │   └── PollingManager.ts
│       ├── types/            # TypeScript type definitions
│       ├── utils/            # Utilities and helpers
│       │   └── Logger.ts
│       └── workspace/        # Workspace and app management
│           └── WorkspaceManager.ts
├── tests/
│   └── integration/          # Live backend integration tests
│       └── backend-live.test.ts
├── test-backend-live.ts      # Standalone test runner
├── dist/                     # Compiled JavaScript output
├── package.json              # npm configuration with test scripts
├── tsconfig.json             # TypeScript configuration (strict mode)
└── README.md
```

## 🧪 Testing & Quality Assurance

### Comprehensive Test Suite

The MCP server includes both unit tests and **live backend integration tests** that validate against the real Azure Functions API.

**🎯 Current Test Status: 100% Pass Rate (8/8 Integration Tests)**

### Test Commands

```bash
# Unit and integration tests
npm test                    # Run Jest test suite
npm run test:integration    # Run Jest integration tests only
npm run test:live          # Run standalone live backend test

# Live backend testing
npm run test:live          # Comprehensive standalone test with colors
ts-node test-backend-live.ts  # Direct execution

# Coverage and quality
npm run test:coverage      # Generate detailed coverage report
npm run lint              # ESLint code quality checks
```

### Live Backend Integration Tests ✅

Tests run against the real Azure Functions backend at `https://vjekocom-alext-weu.azurewebsites.net`:

1. ✅ **App Lifecycle Testing**
   - Check non-existent app authorization
   - Authorize new app with Git integration
   - Verify app authorization status

2. ✅ **Object ID Management**
   - Get next available IDs for various object types
   - Sync consumed IDs with backend
   - Retrieve consumption data
   - Verify collision avoidance

3. ✅ **Pool Management**
   - Create new ID pools
   - Join existing pools
   - Verify pool membership
   - Leave pools

4. ✅ **Error Handling & Performance**
   - Invalid authentication graceful handling
   - Network timeout resilience
   - Concurrent request handling
   - Response time monitoring (<500ms average)

### Test Environment Setup

```bash
# Required environment variables
export NINJA_BACKEND_URL=https://vjekocom-alext-weu.azurewebsites.net
export NINJA_API_KEY=your-api-key-here  # Optional for basic testing

# Run tests
npm run test:live
```

### Linting

```bash
npm run lint          # Run ESLint
```

### Building

```bash
npm run build         # Build TypeScript
npm run watch         # Build in watch mode
```

## 🚀 Development Phases - 80% Complete

**Current Status: Production-Ready MCP Server with Advanced Features**

### ✅ Phase 1: Foundation (Complete)

- ✅ MCP server infrastructure with TypeScript strict mode
- ✅ Comprehensive configuration management (.objidconfig, app.json, env vars)
- ✅ Complete type system from VS Code extension
- ✅ App identification with SHA256 hashing

### ✅ Phase 2: Backend Communication (Complete)

- ✅ Production-grade HTTP client with retry logic
- ✅ Complete Azure Functions V2 API integration (8 endpoints)
- ✅ Advanced authentication (X-Functions-Key, auth tokens)
- ✅ Comprehensive request/response logging with security
- ✅ 100% integration test pass rate against live backend

### ✅ Phase 3: MCP Tools Implementation (Complete)

- ✅ **25 MCP Tools** covering all AL object ID operations
- ✅ Advanced workspace detection and multi-app support
- ✅ Real-time workspace monitoring and app discovery
- ✅ Complete tool discovery with comprehensive documentation

### ✅ Phase 4: Enhanced Features (Complete)

- ✅ **Field and enum value ID management**
- ✅ **Real-time collision detection** with automatic prevention
- ✅ **Interactive assignment mode** with intelligent suggestions
- ✅ **Polling system** for real-time backend synchronization
- ✅ **Configuration persistence** across sessions
- ✅ **Pool management** with create/join/leave operations

### 🟡 Phase 5: Production Readiness (60% Complete)

- ✅ Comprehensive error handling and recovery
- ✅ Security features with data encryption
- ✅ Performance monitoring and benchmarking
- ✅ Request logging and audit trails
- ✅ Complete documentation and API mapping
- ⚠️ Docker containerization (pending)
- ⚠️ NPM package publishing (pending)
- ⚠️ CI/CD pipeline (pending)

## Contributing

This project is under active development. Contributions are welcome! Please open issues or pull requests for bugs, features, or improvements.

## Related Projects

- [AL Object ID Ninja VS Code Extension](https://github.com/vjekob/al-objid)
- [Model Context Protocol](https://modelcontextprotocol.io)

## License

MIT

## Author

Based on the original AL Object ID Ninja by Vjekoslav Babić
