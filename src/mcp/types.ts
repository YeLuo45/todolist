/**
 * MCP Types for TodoList
 */

export type TaskStatus = 'pending' | 'completed' | 'overdue'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string
  createdAt: string
  completedAt?: string
  tags: string[]
}

export interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  handler: (args?: Record<string, unknown>) => Promise<{
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
  }>
}

export interface McpRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: {
    name?: string
    arguments?: Record<string, unknown>
  }
}

export interface McpResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: {
    tools: McpTool[]
  }
  error?: {
    code: number
    message: string
  }
}
