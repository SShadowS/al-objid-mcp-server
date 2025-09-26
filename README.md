# AL Object ID Ninja MCP Server

MCP (Model Context Protocol) server for AL Object ID management in Microsoft Dynamics 365 Business Central development.

## 🚀 Quick Start

Add to Claude Code with one command:

```bash
# Standard mode (8 tools) - Recommended for teams
claude mcp add objid @sshadows/objid-mcp --env MCP_MODE=standard

# Lite mode (4 tools) - For individual developers
claude mcp add objid @sshadows/objid-mcp --env MCP_MODE=lite
```

That's it! The server will be available in Claude Code immediately.

## 📝 Manual MCP Configuration

If you prefer to configure manually, add to your MCP settings JSON:

### Standard Mode (Recommended)
```json
{
  "mcpServers": {
    "objid": {
      "command": "npx",
      "args": ["-y", "@sshadows/objid-mcp"],
      "env": {
        "MCP_MODE": "standard"
      }
    }
  }
}
```

### Lite Mode
```json
{
  "mcpServers": {
    "objid": {
      "command": "npx",
      "args": ["-y", "@sshadows/objid-mcp"],
      "env": {
        "MCP_MODE": "lite"
      }
    }
  }
}
```

### Custom Backend
```json
{
  "mcpServers": {
    "objid": {
      "command": "npx",
      "args": ["-y", "@sshadows/objid-mcp"],
      "env": {
        "MCP_MODE": "standard",
        "BACKEND_URL": "https://your-backend.azurewebsites.net",
        "BACKEND_API_KEY": "your-api-key",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## 🛠️ Available Tools

### LITE Mode (4 tools)
- **`authorization`** - Manage app authorization with backend
- **`config`** - Read and write .objidconfig files
- **`allocate_id`** - Allocate object IDs for AL objects
- **`analyze_workspace`** - Analyze workspace structure and apps

### STANDARD Mode (8 tools - includes all LITE tools plus)
- **`pool`** - Manage app pools for team collaboration
- **`consumption`** - Get consumption reports and statistics
- **`sync`** - Synchronize object IDs with backend
- **`log`** - Retrieve activity logs and audit trail

## 📋 Tool Details

### Core Tools (LITE Mode)

#### `authorization`
Manage app authorization with the AL Object ID Ninja backend:
- Check authorization status
- Authorize apps with backend
- Manage authorization keys

#### `config`
Configuration file management:
- Read .objidconfig files
- Write configuration changes
- Manage AL object ID ranges

#### `allocate_id`
Object ID allocation:
- Get next available object ID
- Support for all AL object types
- Range-aware allocation

#### `analyze_workspace`
Workspace analysis:
- Scan for AL apps
- Detect configurations
- Analyze project structure

### Team Collaboration Tools (STANDARD Mode)

#### `pool`
App pool management for teams:
- Create app pools
- Join existing pools
- Leave pools
- Get pool information

#### `consumption`
Usage tracking and reporting:
- Get detailed consumption statistics
- Track ID usage over time
- Generate usage reports

#### `sync`
Backend synchronization:
- Sync object IDs with backend
- Check synchronization status
- Force synchronization

#### `log`
Activity logging and audit:
- Retrieve activity logs
- Filter by event type, user, or date
- Audit trail for compliance

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_MODE` | Server mode: `lite` or `standard` | `lite` |
| `BACKEND_URL` | Custom backend URL | `https://vjekocom-alext-weu.azurewebsites.net` |
| `BACKEND_API_KEY` | API key for custom backend | None (not required for default backend) |
| `LOG_LEVEL` | Logging level: `error`, `warn`, `info`, `debug` | `info` |
| `CACHE_ENABLED` | Enable response caching | `true` |
| `CACHE_TTL` | Cache time-to-live in milliseconds | `300000` (5 minutes) |

## 📦 About

The AL Object ID Ninja MCP Server provides intelligent object ID management for Business Central AL development. It integrates with the AL Object ID Ninja backend to prevent ID collisions, track usage, and enable team collaboration.

### Features
- **Collision Prevention** - Automatic ID conflict detection
- **Team Collaboration** - Shared ID pools for teams
- **Usage Tracking** - Comprehensive consumption reports
- **Git Integration** - Automatic app identification via Git
- **Zero Configuration** - Works out-of-the-box with default backend

### Related Projects
- [AL Object ID Ninja VS Code Extension](https://github.com/vjekob/al-objid)
- [Model Context Protocol](https://modelcontextprotocol.io)

---

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/SShadowS/objid-mcp.git
cd objid-mcp/mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

### Testing

```bash
npm test                    # Run test suite
npm run test:e2e           # Run E2E tests
npm run typecheck          # TypeScript type checking
npm run lint               # ESLint
npm run prerelease         # Full release check
```

### Project Structure

```
mcp-server/
├── src/v2/
│   ├── server.ts          # Main entry point
│   ├── tools/             # Tool implementations
│   │   ├── lite/          # LITE mode tools
│   │   └── standard/      # STANDARD mode tools
│   └── lib/               # Core libraries
├── tests/v2/              # Test suites
└── dist/v2/               # Compiled output
```

### Contributing

Contributions are welcome! Please open issues or pull requests for bugs, features, or improvements.

## License

MIT

## Author

Based on the original AL Object ID Ninja by Vjekoslav Babić