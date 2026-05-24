import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ToolRegistry, getRegistry, resetRegistry, type Role } from '../../mcp/registry'
import type { McpTool } from '../../mcp/types'

describe('ToolRegistry', () => {
  beforeEach(() => {
    resetRegistry()
  })

  const createMockTool = (name: string): McpTool => ({
    name,
    description: `Mock tool: ${name}`,
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
    handler: async () => ({
      content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }],
    }),
  })

  describe('register', () => {
    it('should register a single tool', () => {
      const registry = getRegistry()
      const tool = createMockTool('test-tool')
      
      registry.register(tool, 'operator')
      
      expect(registry.getTool('test-tool')).toBe(tool)
    })

    it('should allow overwriting existing tool', () => {
      const registry = getRegistry()
      const tool1 = createMockTool('test-tool')
      const tool2 = createMockTool('test-tool')
      
      registry.register(tool1, 'operator')
      registry.register(tool2, 'admin')
      
      expect(registry.getTool('test-tool')).toBe(tool2)
      expect(registry.getRequiredRole('test-tool')).toBe('admin')
    })
  })

  describe('unregister', () => {
    it('should remove a tool from registry', () => {
      const registry = getRegistry()
      const tool = createMockTool('test-tool')
      
      registry.register(tool, 'operator')
      expect(registry.getTool('test-tool')).toBe(tool)
      
      registry.unregister('test-tool')
      expect(registry.getTool('test-tool')).toBeUndefined()
    })

    it('should not throw when unregistering non-existent tool', () => {
      const registry = getRegistry()
      expect(() => registry.unregister('non-existent')).not.toThrow()
    })
  })

  describe('getTool', () => {
    it('should return tool by name', () => {
      const registry = getRegistry()
      const tool = createMockTool('find-me')
      
      registry.register(tool, 'reader')
      
      expect(registry.getTool('find-me')).toBe(tool)
    })

    it('should return undefined for non-existent tool', () => {
      const registry = getRegistry()
      expect(registry.getTool('non-existent')).toBeUndefined()
    })
  })

  describe('listTools', () => {
    it('should return all registered tools', () => {
      const registry = getRegistry()
      const tool1 = createMockTool('tool-1')
      const tool2 = createMockTool('tool-2')
      
      registry.register(tool1, 'reader')
      registry.register(tool2, 'admin')
      
      const tools = registry.listTools()
      expect(tools).toHaveLength(2)
      expect(tools.map(t => t.name)).toContain('tool-1')
      expect(tools.map(t => t.name)).toContain('tool-2')
    })

    it('should return empty array when no tools registered', () => {
      const registry = getRegistry()
      expect(registry.listTools()).toHaveLength(0)
    })
  })

  describe('getToolsByRole', () => {
    it('should return only tools accessible by admin role', () => {
      const registry = getRegistry()
      registry.register(createMockTool('list-tasks'), 'reader')
      registry.register(createMockTool('create-task'), 'operator')
      registry.register(createMockTool('delete-task'), 'admin')
      
      const adminTools = registry.getToolsByRole('admin')
      expect(adminTools.map(t => t.name)).toContain('list-tasks')
      expect(adminTools.map(t => t.name)).toContain('create-task')
      expect(adminTools.map(t => t.name)).toContain('delete-task')
    })

    it('should return only tools accessible by operator role (excluding admin-only tools)', () => {
      const registry = getRegistry()
      registry.register(createMockTool('list-tasks'), 'reader')
      registry.register(createMockTool('create-task'), 'operator')
      registry.register(createMockTool('delete-task'), 'admin')
      
      const operatorTools = registry.getToolsByRole('operator')
      expect(operatorTools.map(t => t.name)).toContain('list-tasks')
      expect(operatorTools.map(t => t.name)).toContain('create-task')
      expect(operatorTools.map(t => t.name)).not.toContain('delete-task')
    })

    it('should return only tools accessible by reader role', () => {
      const registry = getRegistry()
      registry.register(createMockTool('list-tasks'), 'reader')
      registry.register(createMockTool('create-task'), 'operator')
      registry.register(createMockTool('delete-task'), 'admin')
      
      const readerTools = registry.getToolsByRole('reader')
      expect(readerTools.map(t => t.name)).toContain('list-tasks')
      expect(readerTools.map(t => t.name)).not.toContain('create-task')
      expect(readerTools.map(t => t.name)).not.toContain('delete-task')
    })
  })

  describe('getToolSchema', () => {
    it('should return inputSchema for existing tool', () => {
      const registry = getRegistry()
      const tool: McpTool = {
        name: 'schema-test',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
          required: ['id'],
        },
        handler: async () => ({ content: [{ type: 'text' as const, text: '{}' }] }),
      }
      
      registry.register(tool, 'operator')
      
      const schema = registry.getToolSchema('schema-test')
      expect(schema).toBeDefined()
      expect(schema!.properties).toHaveProperty('id')
      expect(schema!.properties).toHaveProperty('name')
    })

    it('should return undefined for non-existent tool', () => {
      const registry = getRegistry()
      expect(registry.getToolSchema('non-existent')).toBeUndefined()
    })
  })

  describe('hasPermission', () => {
    it('should return true when role has access to tool', () => {
      const registry = getRegistry()
      registry.register(createMockTool('read-tool'), 'reader')
      registry.register(createMockTool('write-tool'), 'admin')
      
      expect(registry.hasPermission('read-tool', 'admin')).toBe(true)
      expect(registry.hasPermission('read-tool', 'operator')).toBe(true)
      expect(registry.hasPermission('read-tool', 'reader')).toBe(true)
    })

    it('should return false when role does not have access to tool', () => {
      const registry = getRegistry()
      registry.register(createMockTool('admin-only'), 'admin')
      
      expect(registry.hasPermission('admin-only', 'reader')).toBe(false)
      expect(registry.hasPermission('admin-only', 'operator')).toBe(false)
      expect(registry.hasPermission('admin-only', 'admin')).toBe(true)
    })
  })

  describe('getRequiredRole', () => {
    it('should return the required role for a tool', () => {
      const registry = getRegistry()
      registry.register(createMockTool('role-test'), 'operator')
      
      expect(registry.getRequiredRole('role-test')).toBe('operator')
    })

    it('should return undefined for non-existent tool', () => {
      const registry = getRegistry()
      expect(registry.getRequiredRole('non-existent')).toBeUndefined()
    })
  })

  describe('clear', () => {
    it('should remove all registered tools', () => {
      const registry = getRegistry()
      registry.register(createMockTool('tool-1'), 'reader')
      registry.register(createMockTool('tool-2'), 'admin')
      
      expect(registry.listTools()).toHaveLength(2)
      
      registry.clear()
      
      expect(registry.listTools()).toHaveLength(0)
    })
  })

  describe('registerAll', () => {
    it('should register multiple tools at once', () => {
      const registry = getRegistry()
      const tools = [
        { tool: createMockTool('multi-1'), requiredRole: 'reader' as Role },
        { tool: createMockTool('multi-2'), requiredRole: 'operator' as Role },
        { tool: createMockTool('multi-3'), requiredRole: 'admin' as Role },
      ]
      
      registry.registerAll(tools)
      
      expect(registry.listTools()).toHaveLength(3)
      expect(registry.getTool('multi-1')).toBeDefined()
      expect(registry.getTool('multi-2')).toBeDefined()
      expect(registry.getTool('multi-3')).toBeDefined()
    })
  })

  describe('singleton behavior', () => {
    it('should return the same instance from getRegistry', () => {
      const registry1 = getRegistry()
      const registry2 = getRegistry()
      
      expect(registry1).toBe(registry2)
    })

    it('should reset between tests', () => {
      resetRegistry()
      
      const registry1 = getRegistry()
      registry1.register(createMockTool('singleton-test'), 'reader')
      
      resetRegistry()
      
      const registry2 = getRegistry()
      expect(registry2.getTool('singleton-test')).toBeUndefined()
    })
  })
})