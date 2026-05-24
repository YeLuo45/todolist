/**
 * ToolRegistry Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry } from '../tools/registry'
import { BaseTool } from '../tools/base'
import { registerFilesystemTools } from '../tools/filesystem'

// Simple test tool for testing registry
class TestTool extends BaseTool {
  name = 'test_tool'
  description = 'A test tool'
  parameters = {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Test message' }
    },
    required: ['message']
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    this.validateParams(params, ['message'])
    return `Test: ${params.message}`
  }
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry('/test/workspace')
  })

  it('should create a tool registry instance', () => {
    expect(registry).toBeDefined()
  })

  it('should register a tool', () => {
    const tool = new TestTool()
    registry.register(tool)

    expect(registry.getTool('test_tool')).toBeDefined()
  })

  it('should return tool definitions', () => {
    const tool = new TestTool()
    registry.register(tool)

    const definitions = registry.getToolDefinitions()

    expect(definitions.length).toBe(1)
    expect(definitions[0].name).toBe('test_tool')
    expect(definitions[0].description).toBe('A test tool')
  })

  it('should execute a registered tool', async () => {
    const tool = new TestTool()
    registry.register(tool)

    const result = await registry.execute('test_tool', { message: 'Hello' })

    expect(result).toBe('Test: Hello')
  })

  it('should return error for unknown tool', async () => {
    const result = await registry.execute('unknown_tool', {})

    expect(result).toContain('Unknown tool')
  })

  it('should set and get workspace', () => {
    registry.setWorkspace('/new/workspace')
    expect(registry.getWorkspace()).toBe('/new/workspace')
  })

  it('should validate paths within workspace', () => {
    registry.setWorkspace('/home/hermes')

    const validPath = registry.validatePath('/home/hermes/file.txt')
    expect(validPath).toBe('/home/hermes/file.txt')
  })

  it('should reject paths outside workspace', () => {
    registry.setWorkspace('/home/hermes')

    expect(() => {
      registry.validatePath('/etc/passwd')
    }).toThrow('Path outside workspace')
  })

  it('should register filesystem tools', () => {
    const reg = new ToolRegistry('/test/workspace')
    registerFilesystemTools(reg)

    const defs = reg.getToolDefinitions()
    const toolNames = defs.map((d: { name: string }) => d.name)

    expect(toolNames).toContain('file_read')
    expect(toolNames).toContain('file_write')
    expect(toolNames).toContain('file_patch')
    expect(toolNames).toContain('search')
    expect(toolNames).toContain('cron')
  })
})
