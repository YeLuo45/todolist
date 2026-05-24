import { describe, it, expect, beforeEach } from 'vitest'
import { SmartSorter, DEFAULT_WEIGHTS } from '../../store/SmartSorter'
import type { Task } from '../../store/taskStore'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-1',
    title: 'Test Task',
    completed: false,
    createdAt: new Date().toISOString(),
    priority: 'medium',
    tags: [],
    ...overrides,
  }
}

describe('SmartSorter Enhanced Features', () => {
  let sorter: SmartSorter

  beforeEach(() => {
    sorter = new SmartSorter()
  })

  describe('sortByDeadline', () => {
    beforeEach(() => {
      sorter.updateWeights({ deadline: 1 })
    })

    it('should sort urgent tasks (close deadline) first', () => {
      const now = new Date()
      const tasks = [
        makeTask({ id: 't1', dueDate: new Date(now.getTime() + 48 * 3600 * 1000).toISOString() }),
        makeTask({ id: 't2', dueDate: new Date(now.getTime() + 1 * 3600 * 1000).toISOString() }),
        makeTask({ id: 't3', dueDate: new Date(now.getTime() + 24 * 3600 * 1000).toISOString() }),
      ]
      const result = sorter.sortByDeadline(tasks, now)
      expect(result[0].task.id).toBe('t2') // 1 hour away = highest urgency
      expect(result[1].task.id).toBe('t3') // 24 hours away
      expect(result[2].task.id).toBe('t1') // 48 hours away
    })

    it('should place tasks without deadline at the end', () => {
      const now = new Date()
      const tasks = [
        makeTask({ id: 't1' }), // no deadline
        makeTask({ id: 't2', dueDate: new Date(now.getTime() + 3600 * 1000).toISOString() }),
      ]
      const result = sorter.sortByDeadline(tasks, now)
      expect(result[result.length - 1].task.id).toBe('t1')
    })

    it('should prioritize overdue tasks highest', () => {
      const now = new Date()
      const tasks = [
        makeTask({ id: 't1', dueDate: new Date(now.getTime() - 5 * 3600 * 1000).toISOString() }),
        makeTask({ id: 't2', dueDate: new Date(now.getTime() + 2 * 3600 * 1000).toISOString() }),
      ]
      const result = sorter.sortByDeadline(tasks, now)
      expect(result[0].task.id).toBe('t1') // overdue
    })
  })

  describe('detectUnsortedZone', () => {
    it('should detect tasks with no tags and no category', () => {
      const tasks = [
        makeTask({ id: 't1' }), // unsorted zone
        makeTask({ id: 't2', tags: ['work'] }), // has tag
        makeTask({ id: 't3', category: 'home' }), // has category
        makeTask({ id: 't4', priority: 'high' }), // explicit priority
      ]
      const result = sorter.detectUnsortedZone(tasks)
      expect(result.map(t => t.id)).toEqual(['t1'])
    })

    it('should not flag tasks with at least one distinguishing attribute', () => {
      const tasks = [
        makeTask({ id: 't1', tags: ['misc'] }),
        makeTask({ id: 't2', category: 'inbox' }),
        makeTask({ id: 't3', priority: 'low' }),
      ]
      const result = sorter.detectUnsortedZone(tasks)
      expect(result.length).toBe(0)
    })
  })

  describe('updateWeights', () => {
    it('should update weights at runtime', () => {
      expect(sorter.getWeights().deadline).toBe(0)
      sorter.updateWeights({ deadline: 5 })
      expect(sorter.getWeights().deadline).toBe(5)
    })

    it('should preserve other weights', () => {
      sorter.updateWeights({ priority: 10 })
      expect(sorter.getWeights().priority).toBe(10)
      expect(sorter.getWeights().overdueDays).toBe(DEFAULT_WEIGHTS.overdueDays)
    })
  })

  describe('sortWithCustomScorer', () => {
    it('should sort using custom scorer function', () => {
      const tasks = [
        makeTask({ id: 't1', createdAt: new Date(Date.now() - 10000).toISOString() }),
        makeTask({ id: 't2', createdAt: new Date().toISOString() }),
      ]
      // Custom scorer: higher timestamp = higher score = first (descending order)
      const result = sorter.sortWithCustomScorer(tasks, t =>
        new Date(t.createdAt).getTime()
      )
      expect(result[0].task.id).toBe('t2') // newer = higher timestamp = first
      expect(result[1].task.id).toBe('t1') // older = lower timestamp = second
    })
  })
})