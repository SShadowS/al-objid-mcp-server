#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { BaseTool } from './tools/base/BaseTool';
import {
  AuthorizationTool,
  ConfigTool,
  AllocateIdTool,
  AnalyzeWorkspaceTool
} from './tools/lite';
import {
  PoolTool,
  ConsumptionTool,
  SyncTool,
  LogTool,
  AssignmentTool
} from './tools/standard';
import { Logger } from './lib/utils/logger';
import { ConfigManager } from './lib/config/ConfigManager';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class MCPServer {
  private server: Server;
  private mode: 'lite' | 'standard';
  private tools: Map<string, BaseTool<any, any>>;
  private logger: Logger;
  private config: ConfigManager;

  constructor() {
    this.logger = Logger.getInstance();
    this.config = ConfigManager.getInstance();
    this.mode = this.config.getServerConfig().mode;
    this.tools = new Map();

    this.server = new Server(
      {
        name: 'al-objid-ninja-mcp',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.initializeTools();
    this.setupHandlers();
  }

  private initializeTools(): void {
    this.logger.info(`Initializing MCP Server in ${this.mode.toUpperCase()} mode`);

    if (this.mode === 'lite' || this.mode === 'standard') {
      // Initialize LITE tools
      this.registerTool(new AuthorizationTool());
      this.registerTool(new ConfigTool());
      this.registerTool(new AllocateIdTool());
      this.registerTool(new AnalyzeWorkspaceTool());
    }

    if (this.mode === 'standard') {
      // Register STANDARD mode tools
      this.registerTool(new PoolTool());
      this.registerTool(new ConsumptionTool());
      this.registerTool(new SyncTool());
      this.registerTool(new LogTool());
      this.registerTool(new AssignmentTool());
    }

    this.logger.info(`Loaded ${this.tools.size} tools`);
  }

  private registerTool(tool: BaseTool<any, any>): void {
    const definition = tool.getDefinition();
    this.tools.set(definition.name, tool);
    this.logger.debug(`Registered tool: ${definition.name}`);
  }

  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const toolList = Array.from(this.tools.values()).map(tool =>
        tool.getDefinition()
      );
      this.logger.debug(`Listing ${toolList.length} tools`);
      return { tools: toolList };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const tool = this.tools.get(name);
      if (!tool) {
        this.logger.error(`Tool not found: ${name}`);
        throw new Error(`Tool ${name} not found`);
      }

      this.logger.info(`Executing tool: ${name}`, args);

      try {
        const result = await tool.execute(args || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        this.logger.error(`Tool execution failed: ${name}`, error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: {
                  code: (error as any).code || 'UNKNOWN_ERROR',
                  message: error instanceof Error ? error.message : 'Unknown error',
                  tool: name
                }
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    const serverConfig = this.config.getServerConfig();
    this.logger.info(`MCP Server V2 running in ${this.mode.toUpperCase()} mode`);
    console.error(`MCP Server V2 running in ${this.mode.toUpperCase()} mode`);
    console.error(`Backend: ${serverConfig.backendUrl}`);
    console.error(`Loaded tools: ${Array.from(this.tools.keys()).join(', ')}`);
  }
}

// Entry point
if (require.main === module) {
  const server = new MCPServer();
  server.run().catch(console.error);
}