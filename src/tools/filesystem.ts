/**
 * Filesystem Tools - read/write/patch for workspace files (nanobot-style)
 */

import { BaseTool } from './base'
import { toolRegistry, ToolRegistry } from './registry'

/**
 * file_read tool - Read contents of a file
 */
export class FileReadTool extends BaseTool {
  name = 'file_read'
  description = 'Read the contents of a file from the workspace'

  parameters = this.createSchema(
    {
      path: { type: 'string', description: 'Path to the file to read' },
      offset: { type: 'integer', description: 'Line offset to start reading from (0-indexed)' },
      limit: { type: 'integer', description: 'Maximum number of lines to read' },
    },
    ['path']
  )

  async execute(params: Record<string, unknown>): Promise<string> {
    this.validateParams(params, ['path'])
    const { path, offset = 0, limit = 100 } = params as { path: string; offset?: number; limit?: number }

    try {
      const safePath = toolRegistry.validatePath(path)

      const response = await fetch(`file://${safePath}`)
      if (!response.ok) {
        return `Error: Could not read file ${path}`
      }

      const text = await response.text()
      const lines = text.split('\n')

      if (offset > 0 || limit < lines.length) {
        const start = Math.min(offset, lines.length)
        const end = Math.min(offset + limit, lines.length)
        return lines.slice(start, end).join('\n')
      }

      return text
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      return `Error reading file: ${error}`
    }
  }
}

/**
 * file_write tool - Write content to a file
 */
export class FileWriteTool extends BaseTool {
  name = 'file_write'
  description = 'Write content to a file in the workspace'

  parameters = this.createSchema(
    {
      path: { type: 'string', description: 'Path to the file to write' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    ['path', 'content']
  )

  async execute(params: Record<string, unknown>): Promise<string> {
    this.validateParams(params, ['path', 'content'])
    const { path, content } = params as { path: string; content: string }

    try {
      const safePath = toolRegistry.validatePath(path)

      const response = await fetch(`file://${safePath}`, {
        method: 'PUT',
        body: content,
      })

      if (!response.ok) {
        return `Error: Could not write file ${path}`
      }

      return `Successfully wrote to ${path}`
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      return `Error writing file: ${error}`
    }
  }
}

/**
 * file_patch tool - Apply a patch to a file
 */
export class FilePatchTool extends BaseTool {
  name = 'file_patch'
  description = 'Apply a patch to a file (find and replace)'

  parameters = this.createSchema(
    {
      path: { type: 'string', description: 'Path to the file to patch' },
      old_string: { type: 'string', description: 'String to find and replace' },
      new_string: { type: 'string', description: 'Replacement string' },
    },
    ['path', 'old_string', 'new_string']
  )

  async execute(params: Record<string, unknown>): Promise<string> {
    this.validateParams(params, ['path', 'old_string', 'new_string'])
    const { path, old_string, new_string } = params as {
      path: string
      old_string: string
      new_string: string
    }

    try {
      const safePath = toolRegistry.validatePath(path)

      const response = await fetch(`file://${safePath}`)
      if (!response.ok) {
        return `Error: Could not read file ${path}`
      }

      const text = await response.text()

      if (!text.includes(old_string)) {
        return `Error: old_string not found in file ${path}`
      }

      const newText = text.replace(old_string, new_string)

      const writeResponse = await fetch(`file://${safePath}`, {
        method: 'PUT',
        body: newText,
      })

      if (!writeResponse.ok) {
        return `Error: Could not write file ${path}`
      }

      return `Successfully patched ${path}`
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      return `Error patching file: ${error}`
    }
  }
}

/**
 * search tool - Search for tasks (or files via MessageBus integration)
 */
export class SearchTool extends BaseTool {
  name = 'search'
  description = 'Search for tasks by title, description, or tags'

  parameters = this.createSchema(
    {
      query: { type: 'string', description: 'Search query' },
      type: { type: 'string', description: 'Type of search: tasks, files, or all' },
    },
    ['query']
  )

  async execute(params: Record<string, unknown>): Promise<string> {
    this.validateParams(params, ['query'])
    const { query, type = 'tasks' } = params as { query: string; type?: string }

    try {
      if (type === 'tasks' || type === 'all') {
        return JSON.stringify({ query, type, message: 'Task search would use taskStore' })
      }

      return `Search for "${query}" (type: ${type}) - no results`
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      return `Error searching: ${error}`
    }
  }
}

/**
 * cron tool - Schedule a reminder (basic implementation)
 */
export class CronTool extends BaseTool {
  name = 'cron'
  description = 'Schedule a reminder or recurring task'

  parameters = this.createSchema(
    {
      expression: { type: 'string', description: 'Cron expression or natural language (e.g., "every 5 minutes", "at 3pm")' },
      message: { type: 'string', description: 'Reminder message' },
    },
    ['expression', 'message']
  )

  private reminders: Map<string, ReturnType<typeof setTimeout>> = new Map()

  async execute(params: Record<string, unknown>): Promise<string> {
    this.validateParams(params, ['expression', 'message'])
    const { expression, message } = params as { expression: string; message: string }

    try {
      // Basic cron-like parsing (simplified)
      const id = `reminder-${Date.now()}`

      let intervalMs = 60000 // default 1 minute
      if (expression.includes('minute')) {
        const match = expression.match(/(\d+)/)
        intervalMs = (match ? parseInt(match[1]) : 1) * 60000
      } else if (expression.includes('hour')) {
        const match = expression.match(/(\d+)/)
        intervalMs = (match ? parseInt(match[1]) : 1) * 3600000
      }

      const timerId = setInterval(() => {
        console.log(`[Cron] Reminder: ${message}`)
      }, intervalMs)

      this.reminders.set(id, timerId)

      return `Scheduled reminder "${message}" with interval ${intervalMs}ms (ID: ${id})`
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      return `Error scheduling cron: ${error}`
    }
  }
}

/**
 * Register all filesystem tools with the registry
 */
export function registerFilesystemTools(registry?: ToolRegistry): void {
  const reg = registry || toolRegistry
  const tools = [
    new FileReadTool(),
    new FileWriteTool(),
    new FilePatchTool(),
    new SearchTool(),
    new CronTool(),
  ]

  for (const tool of tools) {
    reg.register(tool)
  }
}