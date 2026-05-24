import { describe, it, expect, beforeEach, vi } from 'vitest'
import { allTools, toolsByName } from '../../mcp/tools'
import { messageBus, MessageTypes } from '../../db/messageBus'

// Mock the database functions
vi.mock('../../db/index', () => ({
  runQuery: vi.fn(),
  execQuery: vi.fn(),
  getOne: vi.fn(),
}))

describe('MCP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset messageBus state
    messageBus.defaultChannel.clear()
    messageBus.messageQueue = []
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
      execQuery.mockReturnValue(mockTasks)

      const tool = toolsByName['list-tasks']
      const result = await tool.handler()

      expect(result.content[0].type).toBe('text')
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.tasks).toHaveLength(2)
    })

    it('should filter by status', async () => {
      const { execQuery } = await import('../../db/index')
      const mockTasks = [
        { id: '1', title: 'Task 1', description: '', status: 'pending', priority: 'medium', due_date: null, created_at: '2025-01-01', completed_at: null, tags: '[]' },
      ]
      execQuery.mockReturnValue(mockTasks)

      const tool = toolsByName['list-tasks']
      const result = await tool.handler({ status: 'pending' })

      expect(execQuery).toHaveBeenCalled()
      const callArgs = execQuery.mock.calls[0]
      expect(callArgs[0]).toContain('status = ?')
      expect(callArgs[1]).toContain('pending')
    })

    it('should filter by priority', async () => {
      const { execQuery } = await import('../../db/index')
      execQuery.mockReturnValue([])

      const tool = toolsByName['list-tasks']
      await tool.handler({ priority: 'high' })

      const callArgs = execQuery.mock.calls[0]
      expect(callArgs[0]).toContain('priority = ?')
      expect(callArgs[1]).toContain('high')
    })
  })

  describe('create-task', () => {
    it('should create a task with required fields', async () => {
      const { runQuery } = await import('../../db/index')
      const tool = toolsByName['create-task']
      const result = await tool.handler({ title: 'New Task' })

      expect(result.content[0].type).toBe('text')
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.task.title).toBe('New Task')
      expect(parsed.task.status).toBe('pending')
      expect(parsed.task.priority).toBe('medium')
      expect(runQuery).toHaveBeenCalled()
    })

    it('should create a task with all fields', async () => {
      const tool = toolsByName['create-task']
      const result = await tool.handler({
        title: 'Full Task',
        description: 'Description',
        priority: 'high',
        dueDate: '2025-05-25',
        tags: ['work', 'urgent'],
      })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.task.title).toBe('Full Task')
      expect(parsed.task.description).toBe('Description')
      expect(parsed.task.priority).toBe('high')
      expect(parsed.task.dueDate).toBe('2025-05-25')
      expect(parsed.task.tags).toEqual(['work', 'urgent'])
    })

    it('should publish TASK_ADDED message', async () => {
      const tool = toolsByName['create-task']
      let receivedMessage = null
      messageBus.subscribe((msg) => { receivedMessage = msg })

      await tool.handler({ title: 'Message Test' })
      
      // Wait for async message bus processing
      await new Promise(resolve => setTimeout(resolve, 50))
      
      expect(receivedMessage).not.toBeNull()
      expect(receivedMessage.type).toBe(MessageTypes.TASK_ADDED)
    })
  })

  describe('update-task', () => {
    it('should update task fields', async () => {
      const { getOne, runQuery } = await import('../../db/index')
      getOne.mockReturnValue({
        id: 'task-1',
        title: 'Old Title',
        description: '',
        status: 'pending',
        priority: 'medium',
        due_date: null,
        created_at: '2025-01-01',
        completed_at: null,
        tags: '[]',
      })

      const tool = toolsByName['update-task']
      const result = await tool.handler({ id: 'task-1', title: 'New Title' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.task.title).toBe('New Title')
      expect(runQuery).toHaveBeenCalled()
    })

    it('should return error for non-existent task', async () => {
      const { getOne } = await import('../../db/index')
      getOne.mockReturnValue(undefined)

      const tool = toolsByName['update-task']
      const result = await tool.handler({ id: 'nonexistent', title: 'Test' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toBe('Task not found')
    })
  })

  describe('delete-task', () => {
    it('should delete an existing task', async () => {
      const { getOne, runQuery } = await import('../../db/index')
      getOne.mockReturnValue({ id: 'task-1' })
      
      const tool = toolsByName['delete-task']
      const result = await tool.handler({ id: 'task-1' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(runQuery).toHaveBeenCalledWith('DELETE FROM tasks WHERE id = ?', ['task-1'])
    })

    it('should return error for non-existent task', async () => {
      const { getOne } = await import('../../db/index')
      getOne.mockReturnValue(undefined)

      const tool = toolsByName['delete-task']
      const result = await tool.handler({ id: 'nonexistent' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.error).toBe('Task not found')
    })

    it('should publish TASK_DELETED message', async () => {
      const { getOne } = await import('../../db/index')
      getOne.mockReturnValue({ id: 'task-1' })
      
      const tool = toolsByName['delete-task']
      let receivedMessage = null
      messageBus.subscribe((msg) => { receivedMessage = msg })

      await tool.handler({ id: 'task-1' })
      await new Promise(resolve => setTimeout(resolve, 50))
      
      expect(receivedMessage?.type).toBe(MessageTypes.TASK_DELETED)
    })
  })

  describe('complete-task', () => {
    it('should complete a pending task', async () => {
      const { getOne, runQuery } = await import('../../db/index')
      getOne.mockReturnValueOnce({
        id: 'task-1',
        title: 'Task',
        description: '',
        status: 'pending',
        priority: 'medium',
        due_date: null,
        created_at: '2025-01-01',
        completed_at: null,
        tags: '[]',
      }).mockReturnValueOnce({
        id: 'task-1',
        title: 'Task',
        description: '',
        status: 'completed',
        priority: 'medium',
        due_date: null,
        created_at: '2025-01-01',
        completed_at: '2025-01-02',
        tags: '[]',
      })

      const tool = toolsByName['complete-task']
      const result = await tool.handler({ id: 'task-1' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.task.status).toBe('completed')
    })

    it('should return error for non-existent task', async () => {
      const { getOne } = await import('../../db/index')
      getOne.mockReturnValue(undefined)

      const tool = toolsByName['complete-task']
      const result = await tool.handler({ id: 'nonexistent' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.error).toBe('Task not found')
    })

    it('should publish TASK_COMPLETED message', async () => {
      const { getOne, runQuery } = await import('../../db/index')
      getOne.mockReturnValueOnce({
        id: 'task-1',
        title: 'Task',
        description: '',
        status: 'pending',
        priority: 'medium',
        due_date: null,
        created_at: '2025-01-01',
        completed_at: null,
        tags: '[]',
      }).mockReturnValueOnce({
        id: 'task-1',
        title: 'Task',
        description: '',
        status: 'completed',
        priority: 'medium',
        due_date: null,
        created_at: '2025-01-01',
        completed_at: '2025-01-02',
        tags: '[]',
      })
      
      const tool = toolsByName['complete-task']
      let receivedMessage = null
      messageBus.subscribe((msg) => { receivedMessage = msg })

      await tool.handler({ id: 'task-1' })
      await new Promise(resolve => setTimeout(resolve, 50))
      
      expect(receivedMessage?.type).toBe(MessageTypes.TASK_COMPLETED)
    })
  })

  describe('query-by-tag', () => {
    it('should query tasks by tag', async () => {
      const { execQuery } = await import('../../db/index')
      const mockTasks = [
        { id: '1', title: 'Task 1', description: '', status: 'pending', priority: 'medium', due_date: null, created_at: '2025-01-01', completed_at: null, tags: '["work"]' },
        { id: '2', title: 'Task 2', description: '', status: 'pending', priority: 'medium', due_date: null, created_at: '2025-01-02', completed_at: null, tags: '["work", "urgent"]' },
      ]
      execQuery.mockReturnValue(mockTasks)

      const tool = toolsByName['query-by-tag']
      const result = await tool.handler({ tag: 'work' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.tag).toBe('work')
      expect(parsed.tasks).toHaveLength(2)
    })

    it('should return empty array when no tasks match', async () => {
      const { execQuery } = await import('../../db/index')
      execQuery.mockReturnValue([])

      const tool = toolsByName['query-by-tag']
      const result = await tool.handler({ tag: 'nonexistent' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.tasks).toHaveLength(0)
    })
  })

  describe('get-task', () => {
    it('should get an existing task', async () => {
      const { getOne } = await import('../../db/index')
      getOne.mockReturnValue({
        id: 'task-1',
        title: 'Task',
        description: 'Description',
        status: 'pending',
        priority: 'high',
        due_date: '2025-05-25',
        created_at: '2025-01-01',
        completed_at: null,
        tags: '["work"]',
      })

      const tool = toolsByName['get-task']
      const result = await tool.handler({ id: 'task-1' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.task.id).toBe('task-1')
      expect(parsed.task.title).toBe('Task')
      expect(parsed.task.tags).toEqual(['work'])
    })

    it('should return error for non-existent task', async () => {
      const { getOne } = await import('../../db/index')
      getOne.mockReturnValue(undefined)

      const tool = toolsByName['get-task']
      const result = await tool.handler({ id: 'nonexistent' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.error).toBe('Task not found')
    })
  })
})