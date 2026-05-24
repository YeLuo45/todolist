/**
 * MCP Tool Registry
 * Manages all MCP tools with role-based access control
 */

import type { McpTool } from './types'

export type Role = 'admin' | 'operator' | 'reader'

// Permission matrix: which tools each role can access
const TOOL_PERMISSIONS: Record<Role, string[]> = {
  admin: ['list-tasks', 'create-task', 'update-task', 'delete-task', 'complete-task', 'query-by-tag', 'get-task'],
  operator: ['list-tasks', 'create-task', 'update-task', 'complete-task', 'query-by-tag', 'get-task'],
  reader: ['list-tasks', 'query-by-tag', 'get-task'],
}

// Role hierarchy: higher roles have more permissions
const ROLE_ORDER: Record<Role, number> = {
  reader: 0,
  operator: 1,
  admin: 2,
}

export interface ToolRegistration {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  requiredRole: Role
}

export class ToolRegistry {
  private tools: Map<string, McpTool> = new Map()
  private toolRoles: Map<string, Role> = new Map()

  /**
   * Register a tool with the registry
   */
  register(tool: McpTool, requiredRole: Role = 'operator'): void {
    this.tools.set(tool.name, tool)
    this.toolRoles.set(tool.name, requiredRole)
  }

  /**
   * Unregister a tool by name
   */
  unregister(name: string): void {
    this.tools.delete(name)
    this.toolRoles.delete(name)
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): McpTool | undefined {
    return this.tools.get(name)
  }

  /**
   * List all registered tools
   */
  listTools(): McpTool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get tools filtered by role (tools accessible to that role)
   * Uses role hierarchy: admin > operator > reader
   * A role can access tools registered with that role OR any lower role
   */
  getToolsByRole(role: Role): McpTool[] {
    const roleLevel: Record<Role, number> = { reader: 0, operator: 1, admin: 2 }
    return this.listTools().filter(tool => {
      const required = this.toolRoles.get(tool.name)
      if (!required) return false
      return roleLevel[role] >= roleLevel[required]
    })
  }

  /**
   * Get the inputSchema for a specific tool
   */
  getToolSchema(name: string): Record<string, unknown> | undefined {
    const tool = this.tools.get(name)
    return tool?.inputSchema ?? undefined
  }

  /**
   * Check if a role has permission to use a specific tool
   */
  hasPermission(toolName: string, role: Role): boolean {
    const requiredRole = this.toolRoles.get(toolName)
    if (!requiredRole) return false
    // Higher roles have more permissions - check role hierarchy
    const roleOrder: Record<Role, number> = { reader: 0, operator: 1, admin: 2 }
    return roleOrder[role] >= roleOrder[requiredRole]
  }

  /**
   * Get the required role for a tool
   */
  getRequiredRole(toolName: string): Role | undefined {
    return this.toolRoles.get(toolName)
  }

  /**
   * Clear all registered tools (mainly for testing)
   */
  clear(): void {
    this.tools.clear()
    this.toolRoles.clear()
  }

  /**
   * Register multiple tools at once
   */
  registerAll(tools: Array<{ tool: McpTool; requiredRole: Role }>): void {
    for (const { tool, requiredRole } of tools) {
      this.register(tool, requiredRole)
    }
  }
}

// Singleton instance
let _instance: ToolRegistry | null = null

export function getRegistry(): ToolRegistry {
  if (!_instance) {
    _instance = new ToolRegistry()
  }
  return _instance
}

export function resetRegistry(): void {
  _instance = null
}