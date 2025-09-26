/**
 * Tests for BaseTool
 */

import { z } from 'zod';
import { BaseTool } from './BaseTool';
import { ErrorCode } from '../../lib/types/common/errors';

// Test implementation of BaseTool
class TestTool extends BaseTool<{ name: string; age?: number }, { success: boolean }> {
  constructor() {
    super(
      'test_tool',
      'A test tool',
      z.object({
        name: z.string(),
        age: z.number().optional()
      })
    );
  }

  protected async executeInternal(params: { name: string; age?: number }): Promise<{ success: boolean }> {
    return { success: true };
  }
}

describe('BaseTool', () => {
  let tool: TestTool;

  beforeEach(() => {
    tool = new TestTool();
  });

  it('should return tool definition', () => {
    const definition = tool.getDefinition();
    expect(definition.name).toBe('test_tool');
    expect(definition.description).toBe('A test tool');
    expect(definition.inputSchema).toBeDefined();
  });

  it('should execute with valid parameters', async () => {
    const result = await tool.execute({ name: 'John' });
    expect(result).toEqual({ success: true });
  });

  it('should execute with optional parameters', async () => {
    const result = await tool.execute({ name: 'John', age: 30 });
    expect(result).toEqual({ success: true });
  });

  it('should throw validation error for invalid parameters', async () => {
    await expect(tool.execute({ age: 30 })).rejects.toThrow();
  });

  it('should throw validation error for wrong parameter types', async () => {
    await expect(tool.execute({ name: 123 })).rejects.toThrow();
  });
});