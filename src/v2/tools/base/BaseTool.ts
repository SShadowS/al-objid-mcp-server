/**
 * Base class for all MCP tools
 */

import { z } from 'zod';
import { ErrorCode, MCPError } from '../../lib/types/common/errors';

export abstract class BaseTool<TParams, TResult> {
  constructor(
    protected name: string,
    protected description: string,
    protected schema: z.ZodSchema<TParams>
  ) {}

  /**
   * Execute the tool with validation
   */
  async execute(params: unknown): Promise<TResult> {
    try {
      // Validate parameters
      const validated = this.schema.parse(params);

      // Execute tool logic
      return await this.executeInternal(validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw this.createError(
          ErrorCode.VALIDATION_ERROR,
          `Invalid parameters: ${error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        );
      }

      if (error instanceof ToolError) {
        throw error;
      }

      throw this.createError(
        ErrorCode.TOOL_EXECUTION_ERROR,
        error instanceof Error ? error.message : 'Unknown error during tool execution'
      );
    }
  }

  /**
   * Internal execution logic to be implemented by each tool
   */
  protected abstract executeInternal(params: TParams): Promise<TResult>;

  /**
   * Get tool definition for MCP
   */
  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.getInputSchema(),
    };
  }

  /**
   * Get JSON schema from Zod schema
   */
  private getInputSchema() {
    // This is a simplified version - in production, use a proper Zod to JSON Schema converter
    return {
      type: 'object',
      properties: {},
      required: [],
    };
  }

  /**
   * Create a standardized error
   */
  protected createError(code: ErrorCode, message: string, details?: any): ToolError {
    return new ToolError(code, message, this.name, details);
  }
}

/**
 * Tool-specific error class
 */
export class ToolError extends Error implements MCPError {
  constructor(
    public code: ErrorCode,
    public message: string,
    public tool?: string,
    public details?: any,
    public action?: string
  ) {
    super(message);
    this.name = 'ToolError';
  }
}