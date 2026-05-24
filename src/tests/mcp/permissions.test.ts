import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, getRegistry, resetRegistry, Role } from '../../mcp/registry';
import type { McpTool } from '../../mcp/types';

describe('Permission Control', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    resetRegistry();
    registry = getRegistry();
    // Register the 7 standard MCP tools with appropriate roles
    const standardTools: Array<{ tool: McpTool; requiredRole: Role }> = [
      { tool: makeTool('list-tasks'), requiredRole: 'reader' },
      { tool: makeTool('create-task'), requiredRole: 'operator' },
      { tool: makeTool('update-task'), requiredRole: 'operator' },
      { tool: makeTool('delete-task'), requiredRole: 'admin' },
      { tool: makeTool('complete-task'), requiredRole: 'operator' },
      { tool: makeTool('query-by-tag'), requiredRole: 'reader' },
      { tool: makeTool('get-task'), requiredRole: 'reader' },
    ]
    registry.registerAll(standardTools)
  });

  function callTool(toolName: string, role: Role): { success: boolean; error?: string } {
    if (!registry.hasPermission(toolName, role)) {
      return { success: false, error: 'Permission denied' };
    }
    return { success: true };
  }

  describe('reader role', () => {
    it('should allow read-only tools', () => {
      expect(callTool('list-tasks', 'reader').success).toBe(true);
      expect(callTool('query-by-tag', 'reader').success).toBe(true);
      expect(callTool('get-task', 'reader').success).toBe(true);
    });

    it('should deny write tools', () => {
      expect(callTool('create-task', 'reader').success).toBe(false);
      expect(callTool('create-task', 'reader').error).toBe('Permission denied');
      expect(callTool('delete-task', 'reader').success).toBe(false);
      expect(callTool('update-task', 'reader').success).toBe(false);
      expect(callTool('complete-task', 'reader').success).toBe(false);
    });
  });

  describe('operator role', () => {
    it('should allow read and write tools except delete', () => {
      expect(callTool('list-tasks', 'operator').success).toBe(true);
      expect(callTool('create-task', 'operator').success).toBe(true);
      expect(callTool('update-task', 'operator').success).toBe(true);
      expect(callTool('complete-task', 'operator').success).toBe(true);
    });

    it('should deny admin-only tools', () => {
      expect(callTool('delete-task', 'operator').success).toBe(false);
      expect(callTool('delete-task', 'operator').error).toBe('Permission denied');
    });
  });

  describe('admin role', () => {
    it('should allow all tools', () => {
      expect(callTool('list-tasks', 'admin').success).toBe(true);
      expect(callTool('create-task', 'admin').success).toBe(true);
      expect(callTool('update-task', 'admin').success).toBe(true);
      expect(callTool('delete-task', 'admin').success).toBe(true);
      expect(callTool('complete-task', 'admin').success).toBe(true);
      expect(callTool('query-by-tag', 'admin').success).toBe(true);
      expect(callTool('get-task', 'admin').success).toBe(true);
    });
  });

  describe('getToolsByRole', () => {
    it('reader sees 3 read-only tools', () => {
      const tools = registry.getToolsByRole('reader');
      expect(tools.length).toBe(3);
      expect(tools.map(t => t.name).sort()).toEqual(['get-task', 'list-tasks', 'query-by-tag'].sort());
    });

    it('operator sees 6 tools (read + write except delete)', () => {
      const tools = registry.getToolsByRole('operator');
      expect(tools.length).toBe(6);
    });

    it('admin sees all 7 tools', () => {
      const tools = registry.getToolsByRole('admin');
      expect(tools.length).toBe(7);
    });
  });
});

function makeTool(name: string, role: Role = 'operator'): McpTool {
  return {
    name,
    description: `Mock tool: ${name}`,
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: async () => ({ content: [{ type: 'text' as const, text: '{}' }] }),
  };
}