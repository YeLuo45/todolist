import { describe, it, expect, beforeEach } from 'vitest'
import useTaskStore from '../store/taskStore'
import type { Task } from '../store/taskStore'

function makeTask(overrides: Partial<Task> = {}): Omit<Task, 'id' | 'createdAt'> {
  return {
    title: 'Test',
    description: '',
    status: 'pending',
    priority: 'medium',
    tags: [],
    ...overrides,
  }
}

describe('useTaskStore', () => {
  beforeEach(() => {
    useTaskStore.setState({ tasks: [], subscribers: [] })
  })

  describe('addTask', () => {
    it('adds a task and returns an id', () => {
      const id = useTaskStore.getState().addTask(makeTask())
      expect(id).toBeTruthy()
      expect(useTaskStore.getState().tasks).toHaveLength(1)
    })

    it('sets createdAt timestamp', () => {
      useTaskStore.getState().addTask(makeTask())
      const task = useTaskStore.getState().tasks[0]
      expect(task.createdAt).toBeTruthy()
    })

    it('respects provided fields', () => {
      useTaskStore.getState().addTask(makeTask({ title: 'My Task', priority: 'high' }))
      const task = useTaskStore.getState().tasks[0]
      expect(task.title).toBe('My Task')
      expect(task.priority).toBe('high')
    })
  })

  describe('updateTask', () => {
    it('updates task fields', () => {
      const id = useTaskStore.getState().addTask(makeTask({ title: 'old' }))
      useTaskStore.getState().updateTask(id, { title: 'new' })
      expect(useTaskStore.getState().tasks[0].title).toBe('new')
    })

    it('does nothing for unknown id', () => {
      useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().updateTask('unknown', { title: 'new' })
      expect(useTaskStore.getState().tasks[0].title).toBe('Test')
    })
  })

  describe('deleteTask', () => {
    it('removes task from list', () => {
      const id = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().deleteTask(id)
      expect(useTaskStore.getState().tasks).toHaveLength(0)
    })

    it('does nothing for unknown id', () => {
      const id = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().deleteTask('unknown')
      expect(useTaskStore.getState().tasks).toHaveLength(1)
    })
  })

  describe('completeTask', () => {
    it('changes status to completed', () => {
      const id = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().completeTask(id)
      expect(useTaskStore.getState().tasks[0].status).toBe('completed')
    })

    it('sets completedAt', () => {
      const id = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().completeTask(id)
      expect(useTaskStore.getState().tasks[0].completedAt).toBeTruthy()
    })

    it('does nothing for unknown id', () => {
      const id = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().completeTask('unknown')
      expect(useTaskStore.getState().tasks[0].status).toBe('pending')
    })
  })

  describe('batchComplete', () => {
    it('completes multiple tasks', () => {
      const id1 = useTaskStore.getState().addTask(makeTask())
      const id2 = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().batchComplete([id1, id2])
      const tasks = useTaskStore.getState().tasks
      expect(tasks.every(t => t.status === 'completed')).toBe(true)
    })

    it('ignores non-existent ids', () => {
      const id1 = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().batchComplete([id1, 'nonexistent'])
      expect(useTaskStore.getState().tasks[0].status).toBe('completed')
    })

    it('only completes tasks with matching ids', () => {
      const id1 = useTaskStore.getState().addTask(makeTask())
      const id2 = useTaskStore.getState().addTask(makeTask())
      const id3 = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().batchComplete([id1, id3])
      const tasks = useTaskStore.getState().tasks
      expect(tasks.find(t => t.id === id1)!.status).toBe('completed')
      expect(tasks.find(t => t.id === id2)!.status).toBe('pending')
      expect(tasks.find(t => t.id === id3)!.status).toBe('completed')
    })
  })

  describe('batchDelete', () => {
    it('deletes multiple tasks', () => {
      const id1 = useTaskStore.getState().addTask(makeTask())
      const id2 = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().batchDelete([id1, id2])
      expect(useTaskStore.getState().tasks).toHaveLength(0)
    })

    it('ignores non-existent ids', () => {
      const id1 = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().batchDelete([id1, 'nonexistent'])
      expect(useTaskStore.getState().tasks).toHaveLength(0)
    })

    it('only deletes tasks with matching ids', () => {
      const id1 = useTaskStore.getState().addTask(makeTask())
      const id2 = useTaskStore.getState().addTask(makeTask())
      const id3 = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().batchDelete([id1, id3])
      const tasks = useTaskStore.getState().tasks
      expect(tasks).toHaveLength(1)
      expect(tasks[0].id).toBe(id2)
    })
  })

  describe('subscribe', () => {
    it('receives TASK_ADDED events', () => {
      let receivedEvent = null
      useTaskStore.getState().subscribe(e => { receivedEvent = e })
      useTaskStore.getState().addTask(makeTask())
      expect(receivedEvent).not.toBeNull()
      expect(receivedEvent!.type).toBe('TASK_ADDED')
    })

    it('receives TASK_DELETED events', () => {
      let receivedEvent = null
      const id = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().subscribe(e => { receivedEvent = e })
      useTaskStore.getState().deleteTask(id)
      expect(receivedEvent!.type).toBe('TASK_DELETED')
    })

    it('receives TASK_COMPLETED events', () => {
      let receivedEvent = null
      const id = useTaskStore.getState().addTask(makeTask())
      useTaskStore.getState().subscribe(e => { receivedEvent = e })
      useTaskStore.getState().completeTask(id)
      expect(receivedEvent!.type).toBe('TASK_COMPLETED')
    })

    it('returns unsubscribe function', () => {
      const unsubscribe = useTaskStore.getState().subscribe(() => {})
      const countBefore = useTaskStore.getState().subscribers.length
      unsubscribe()
      expect(useTaskStore.getState().subscribers.length).toBe(countBefore - 1)
    })
  })

  describe('publish', () => {
    it('forwards events to all subscribers', () => {
      let count = 0
      useTaskStore.getState().subscribe(() => { count++ })
      useTaskStore.getState().subscribe(() => { count++ })
      useTaskStore.getState().addTask(makeTask())
      expect(count).toBe(2)
    })
  })
})
