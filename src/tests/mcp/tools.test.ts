import { describe, it, expect, beforeEach, vi } from 'vitest'
import { allTools, toolsByName } from '../../mcp/tools'
import { messageBus, MessageTypes } from '../../db/messageBus'

// Mock the database functions
vi.mock('../../db/index', () => ({
  runQuery: vi.fn(),
  execQuery: vi.fn<(sql: string, params?: unknown[]) => unknown[]>(),
  getOne: vi.fn<(sql: string, params?: unknown[]) => unknown>(),
}))

describe('MCP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset messageBus state using reset() method
    messageBus.reset()
  })

  describe('Tool Registration', () => {
    it('should register all 7 tools', () => {
      expect(allTools).toHaveLength(7)
    })

    it('should have correct tool names', () => {
      const expectedNames = [
        'list-tasks',
        'create-task',
        'update-task',
        'delete-task',
        'complete-task',
        'query-by-tag',
        'get-task',
      ]
      expectedNames.forEach(name => {
        expect(toolsByName[name]).toBeDefined()
      })
    })
  })

  describe('list-tasks', () => {
    it('should list all tasks without filters', async () => {
      const { execQuery } = await import('../../db/index')
      const mockTasks = [
        { id: '1', title: 'Task 1', description: '', status: 'pending', priority: 'medium', due_date: null, created_at: '2025-01-01', completed_at: null, tags: '[]' },
        { id: '2', title: 'Task 2', description: '', status: 'completed', priority: 'high', due_date: null, created_at: '2025-01-02', completed_at: null, tags: '[]' },
      ]
      ;(execQuery as ReturnType<typeof vi.fn>).mockReturnValue(mockTasks)

      const tool = toolsByName['list-tasks']
      const result = await tool.handler({})

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.tasks).toHaveLength(2)
    })

    it('should filter by status', async () => {
      const { execQuery } = await import('../../db/index')
      const mockTasks = [
        { id: '1', title: 'Task 1', description: '', status: 'pending', priority: 'medium', due_date: null, created_at: '2025-01-01', completed_at: null, tags: '[]' },
      ]
      ;(execQuery as ReturnType<typeof vi.fn>).mockReturnValue(mockTasks)

      const tool = toolsByName['list-tasks']
      const result = await tool.handler({ status: 'pending' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.tasks).toHaveLength(1)
      expect(parsed.tasks[0].status).toBe('pending')
    })
  })

  describe('create-task', () => {
    it('should create a task', async () => {
      const { runQuery } = await import('../../db/index')
      ;(runQuery as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

      const tool = toolsByName['create-task']
      const result = await tool.handler({
        title: 'New Task',
        description: 'Task description',
        priority: 'high',
      })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.task.title).toBe('New Task')
      expect(parsed.task.priority).toBe('high')
    })

    it('should require title', async () => {
      const tool = toolsByName['create-task']
      const result = await tool.handler({})

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toBe('Title is required')
    })

    it('should publish TASK_ADDED message', async () => {
      const { runQuery } = await import('../../db/index')
      ;(runQuery as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

      let receivedMessage: { type: string; payload: Record<string, unknown> } | null = null
      messageBus.subscribe(msg => {
        receivedMessage = msg as typeof receivedMessage
      })

      const tool = toolsByName['create-task']
      await tool.handler({ title: 'Test Task' })
      // Flush the async message queue
      await messageBus.flush()

      expect(receivedMessage).not.toBeNull()
      expect(receivedMessage!.type).toBe(MessageTypes.TASK_ADDED)
    })
  })

  describe('update-task', () => {
    it('should update task title', async () => {
      const { runQuery: rq, getOne: go } = await import('../../db/index')
      const mockTask = {
        id: 'task-1', title: 'Old Title', description: '', status: 'pending',
        priority: 'medium', due_date: null, created_at: '2025-01-01',
        completed_at: null, tags: '[]',
      }
      ;(go as ReturnType<typeof vi.fn>).mockReturnValue(mockTask)
      ;(rq as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

      const tool = toolsByName['update-task']
      const result = await tool.handler({ id: 'task-1', title: 'New Title' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.task.title).toBe('New Title')
    })

    it('should return error for non-existent task', async () => {
      const { getOne: go } = await import('../../db/index')
      ;(go as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

      const tool = toolsByName['update-task']
      const result = await tool.handler({ id: 'nonexistent' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toBe('Task not found')
    })
  })

  describe('delete-task', () => {
    it('should delete a task', async () => {
      const { runQuery: rq, getOne: go } = await import('../../db/index')
      const mockTask = {
        id: 'task-1', title: 'Task', description: '', status: 'pending',
        priority: 'medium', due_date: null, created_at: '2025-01-01',
        completed_at: null, tags: '[]',
      }
      ;(go as ReturnType<typeof vi.fn>).mockReturnValue(mockTask)
      ;(rq as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

      const tool = toolsByName['delete-task']
      const result = await tool.handler({ id: 'task-1' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
    })

    it('should return error for non-existent task', async () => {
      const { getOne: go } = await import('../../db/index')
      ;(go as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

      const tool = toolsByName['delete-task']
      const result = await tool.handler({ id: 'nonexistent' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toBe('Task not found')
    })
  })

  describe('complete-task', () => {
    it('should complete a pending task', async () => {
      const { getOne, runQuery } = await import('../../db/index')
      const mockTask = {
        id: 'task-1',
        status: 'pending',
        title: 'Task',
        description: '',
        priority: 'medium',
        due_date: null,
        created_at: '2025-01-01',
        completed_at: null,
        tags: '[]',
      }
      // First call: get existing task, Second call: get updated task
      ;(getOne as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockTask).mockReturnValueOnce({ ...mockTask, status: 'completed', completed_at: '2025-06-24T12:00:00Z' })
      ;(runQuery as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

      const tool = toolsByName['complete-task']
      const result = await tool.handler({ id: 'task-1' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.task.status).toBe('completed')
      expect(runQuery).toHaveBeenCalled()
    })

    it('should return error for non-existent task', async () => {
      const { getOne } = await import('../../db/index')
      ;(getOne as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

      const tool = toolsByName['complete-task']
      const result = await tool.handler({ id: 'nonexistent' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toBe('Task not found')
    })
  })

  describe('query-by-tag', () => {
    it('should return tasks with the specified tag', async () => {
      const { execQuery } = await import('../../db/index')
      const mockTasks = [
        { id: '1', title: 'Task 1', description: '', status: 'pending', priority: 'medium', due_date: null, created_at: '2025-01-01', completed_at: null, tags: '["work"]' },
      ]
      ;(execQuery as ReturnType<typeof vi.fn>).mockReturnValue(mockTasks)

      const tool = toolsByName['query-by-tag']
      const result = await tool.handler({ tag: 'work' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.tasks).toHaveLength(1)
      expect(parsed.tasks[0].tags).toContain('work')
    })

    it('should return empty array for non-existent tag', async () => {
      const { execQuery } = await import('../../db/index')
      ;(execQuery as ReturnType<typeof vi.fn>).mockReturnValue([])

      const tool = toolsByName['query-by-tag']
      const result = await tool.handler({ tag: 'nonexistent' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.tasks).toHaveLength(0)
    })
  })

  describe('get-task', () => {
    it('should return a task by id', async () => {
      const { getOne } = await import('../../db/index')
      ;(getOne as ReturnType<typeof vi.fn>).mockReturnValue({
        id: 'task-1',
        title: 'Task 1',
        description: 'Description',
        status: 'pending',
        priority: 'high',
        due_date: '2025-12-31',
        created_at: '2025-01-01',
        completed_at: null,
        tags: '["work", "urgent"]',
      })

      const tool = toolsByName['get-task']
      const result = await tool.handler({ id: 'task-1' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.task.id).toBe('task-1')
      expect(parsed.task.title).toBe('Task 1')
    })

    it('should return error for non-existent task', async () => {
      const { getOne } = await import('../../db/index')
      ;(getOne as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

      const tool = toolsByName['get-task']
      const result = await tool.handler({ id: 'nonexistent' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toBe('Task not found')
    })
  })
})
