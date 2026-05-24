/**
 * MCP Tool Definitions for TodoList
 * Implements 7 tools: list-tasks, create-task, update-task, delete-task, complete-task, query-by-tag, get-task
 */

import { messageBus, MessageTypes } from '../db/messageBus'
import { execQuery } from '../db/index'
import type { Task, TaskStatus, TaskPriority, McpTool } from './types'

// SQL row to Task object (same as taskStore)
function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    dueDate: row.due_date as string | undefined,
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | undefined,
    tags: JSON.parse((row.tags as string) || '[]'),
  }
}

/**
 * list-tasks: List all tasks with optional filtering
 */
export const listTasksTool: McpTool = {
  name: 'list-tasks',
  description: 'List all tasks with optional filtering by status, priority, or tag',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'completed', 'overdue'],
        description: 'Filter by task status',
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Filter by task priority',
      },
      tag: {
        type: 'string',
        description: 'Filter by tag name',
      },
    },
  },
  handler: async (args?: Record<string, unknown>) => {
    let sql = 'SELECT * FROM tasks WHERE 1=1'
    const params: unknown[] = []

    if (args?.status) {
      sql += ' AND status = ?'
      params.push(args.status)
    }

    if (args?.priority) {
      sql += ' AND priority = ?'
      params.push(args.priority)
    }

    sql += ' ORDER BY created_at DESC'

    const rows = execQuery<Record<string, unknown>>(sql, params)
    let tasks = rows.map(rowToTask)

    // Filter by tag if specified (client-side tag filtering)
    if (args?.tag) {
      tasks = tasks.filter(t => t.tags.includes(args.tag as string))
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: true, tasks }, null, 2),
        },
      ],
    }
  },
}

/**
 * create-task: Create a new task
 */
export const createTaskTool: McpTool = {
  name: 'create-task',
  description: 'Create a new task with title, description, priority, due date, and tags',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Task title (required)',
      },
      description: {
        type: 'string',
        description: 'Task description',
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Task priority',
        default: 'medium',
      },
      dueDate: {
        type: 'string',
        description: 'Due date in ISO format (e.g., "2025-05-25")',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of tag names',
      },
    },
    required: ['title'],
  },
  handler: async (args?: Record<string, unknown>) => {
    if (!args?.title) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Title is required' }, null, 2) }],
        isError: true,
      }
    }

    const { runQuery } = await import('../db/index')
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const now = new Date().toISOString()
    const status: TaskStatus = 'pending'
    const priority: TaskPriority = (args.priority as TaskPriority) || 'medium'

    const task: Task = {
      id,
      title: args.title as string,
      description: (args.description as string) || '',
      status,
      priority,
      dueDate: args.dueDate as string | undefined,
      createdAt: now,
      completedAt: undefined,
      tags: (args.tags as string[]) || [],
    }

    runQuery(
      `INSERT INTO tasks (id, title, description, status, priority, due_date, created_at, completed_at, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.dueDate || null,
        task.createdAt,
        task.completedAt || null,
        JSON.stringify(task.tags),
      ]
    )

    const msg = {
      type: MessageTypes.TASK_ADDED,
      payload: { taskId: id, task },
      ts: now,
    }
    messageBus.publish(msg)

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ success: true, task }, null, 2) }],
    }
  },
}

/**
 * update-task: Update an existing task
 */
export const updateTaskTool: McpTool = {
  name: 'update-task',
  description: 'Update an existing task by ID',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Task ID (required)' },
      title: { type: 'string', description: 'New title' },
      description: { type: 'string', description: 'New description' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'New priority' },
      dueDate: { type: 'string', description: 'New due date in ISO format' },
      tags: { type: 'array', items: { type: 'string' }, description: 'New list of tags' },
    },
    required: ['id'],
  },
  handler: async (args?: Record<string, unknown>) => {
    if (!args?.id) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'ID is required' }, null, 2) }],
        isError: true,
      }
    }

    const { runQuery: rq, getOne: go } = await import('../db/index')
    const existing = go<Record<string, unknown>>('SELECT * FROM tasks WHERE id = ?', [args.id as string])

    if (!existing) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Task not found' }, null, 2) }],
        isError: true,
      }
    }

    const updated: Task = {
      ...rowToTask(existing),
      title: (args.title as string) ?? (existing.title as string),
      description: (args.description as string) ?? (existing.description as string),
      priority: (args.priority as TaskPriority) ?? (existing.priority as TaskPriority),
      dueDate: (args.dueDate as string) ?? (existing.due_date as string | undefined),
      tags: (args.tags as string[]) ?? JSON.parse((existing.tags as string) || '[]'),
    }

    rq(
      `UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, completed_at = ?, tags = ? WHERE id = ?`,
      [updated.title, updated.description, updated.status, updated.priority, updated.dueDate || null, updated.completedAt || null, JSON.stringify(updated.tags), args.id]
    )

    const now = new Date().toISOString()
    const msg = { type: MessageTypes.TASK_UPDATED, payload: { taskId: args.id, task: updated }, ts: now }
    messageBus.publish(msg)

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ success: true, task: updated }, null, 2) }],
    }
  },
}

/**
 * delete-task: Delete a task
 */
export const deleteTaskTool: McpTool = {
  name: 'delete-task',
  description: 'Delete a task by ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Task ID (required)' } },
    required: ['id'],
  },
  handler: async (args?: Record<string, unknown>) => {
    if (!args?.id) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'ID is required' }, null, 2) }],
        isError: true,
      }
    }

    const { runQuery: rq, getOne: go } = await import('../db/index')
    const existing = go<Record<string, unknown>>('SELECT * FROM tasks WHERE id = ?', [args.id as string])

    if (!existing) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Task not found' }, null, 2) }],
        isError: true,
      }
    }

    rq('DELETE FROM tasks WHERE id = ?', [args.id])

    const now = new Date().toISOString()
    const msg = { type: MessageTypes.TASK_DELETED, payload: { taskId: args.id }, ts: now }
    messageBus.publish(msg)

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ success: true }, null, 2) }],
    }
  },
}

/**
 * complete-task: Mark a task as completed
 */
export const completeTaskTool: McpTool = {
  name: 'complete-task',
  description: 'Mark a task as completed',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Task ID (required)' } },
    required: ['id'],
  },
  handler: async (args?: Record<string, unknown>) => {
    if (!args?.id) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'ID is required' }, null, 2) }],
        isError: true,
      }
    }

    const { runQuery: rq, getOne: go } = await import('../db/index')
    const existing = go<Record<string, unknown>>('SELECT * FROM tasks WHERE id = ?', [args.id as string])

    if (!existing) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Task not found' }, null, 2) }],
        isError: true,
      }
    }

    const now = new Date().toISOString()
    rq('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?', ['completed', now, args.id])

    const updated = go<Record<string, unknown>>('SELECT * FROM tasks WHERE id = ?', [args.id])
    const task = updated ? rowToTask(updated) : null

    const msg = { type: MessageTypes.TASK_COMPLETED, payload: { taskId: args.id, task }, ts: now }
    messageBus.publish(msg)

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ success: true, task }, null, 2) }],
    }
  },
}

/**
 * query-by-tag: Query tasks by tag name
 */
export const queryByTagTool: McpTool = {
  name: 'query-by-tag',
  description: 'Query all tasks that have a specific tag',
  inputSchema: {
    type: 'object',
    properties: { tag: { type: 'string', description: 'Tag name to search for (required)' } },
    required: ['tag'],
  },
  handler: async (args?: Record<string, unknown>) => {
    if (!args?.tag) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Tag is required' }, null, 2) }],
        isError: true,
      }
    }

    const { execQuery: eq } = await import('../db/index')
    const rows = eq<Record<string, unknown>>('SELECT * FROM tasks ORDER BY created_at DESC')
    const tasks = rows.map(rowToTask).filter(t => t.tags.includes(args.tag as string))

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ success: true, tag: args.tag, tasks }, null, 2) }],
    }
  },
}

/**
 * get-task: Get a single task by ID
 */
export const getTaskTool: McpTool = {
  name: 'get-task',
  description: 'Get a single task by its ID',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Task ID (required)' } },
    required: ['id'],
  },
  handler: async (args?: Record<string, unknown>) => {
    if (!args?.id) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'ID is required' }, null, 2) }],
        isError: true,
      }
    }

    const { getOne: go } = await import('../db/index')
    const row = go<Record<string, unknown>>('SELECT * FROM tasks WHERE id = ?', [args.id as string])

    if (!row) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Task not found' }, null, 2) }],
        isError: true,
      }
    }

    const task = rowToTask(row)
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ success: true, task }, null, 2) }],
    }
  },
}

export const allTools: McpTool[] = [
  listTasksTool, createTaskTool, updateTaskTool, deleteTaskTool, completeTaskTool, queryByTagTool, getTaskTool,
]

export const toolsByName: Record<string, McpTool> = {
  'list-tasks': listTasksTool,
  'create-task': createTaskTool,
  'update-task': updateTaskTool,
  'delete-task': deleteTaskTool,
  'complete-task': completeTaskTool,
  'query-by-tag': queryByTagTool,
  'get-task': getTaskTool,
}
