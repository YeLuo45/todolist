/**
 * ToolRegistry - Dynamic tool discovery and execution (nanobot-style)
 */

import { BaseTool } from './base'

/**
 * ToolRegistry manages all available tools, supports discovery, registration, and execution
 */
export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map()
  private workspace: string

  constructor(workspace: string = '/home/hermes') {
    this.workspace = workspace
  }

  /**
   * Discover and load built-in tools
   */
  discoverTools(): void {
    // Auto-register built-in tools
    if (this.tools.size === 0) {
      // Import and register filesystem tools lazily
      import('./filesystem').then(m => {
        m.registerFilesystemTools(this)
      }).catch(() => {
        // fallback: register individually if dynamic import fails
        console.log('[ToolRegistry] Skipping filesystem tool auto-registration')
      })
    }
    console.log('[ToolRegistry] Discovered tools:', Array.from(this.tools.keys()))
  }

  /**
   * Register a tool
   */
  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool)
    console.log(`[ToolRegistry] Registered tool: ${tool.name}`)
  }

  /**
   * Get all tool definitions (for LLM)
   */
  getToolDefinitions(): { name: string; description: string; parameters: Record<string, unknown> }[] {
    return Array.from(this.tools.values()).map(tool => tool.getDefinition())
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name)
  }

  /**
   * Execute a tool by name
   */
  async execute(toolName: string, args: Record<string, unknown> = {}): Promise<string> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      return `Error: Unknown tool '${toolName}'`
    }

    try {
      const result = await tool.execute(args)
      return result
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      return `Error executing ${toolName}: ${error}`
    }
  }

  /**
   * Set the workspace for sandboxed file access
   */
  setWorkspace(path: string): void {
    this.workspace = path
  }

  /**
   * Get the workspace path
   */
  getWorkspace(): string {
    return this.workspace
  }

  /**
   * Validate that a path is within the workspace
   */
  validatePath(requestedPath: string): string {
    const fullPath = requestedPath.startsWith('/')
      ? requestedPath
      : `${this.workspace}/${requestedPath}`.replace(/\/+/g, '/')

    if (!fullPath.startsWith(this.workspace)) {
      throw new Error(`Path outside workspace: ${requestedPath}`)
    }
    return fullPath
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry()
