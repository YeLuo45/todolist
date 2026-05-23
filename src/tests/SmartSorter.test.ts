import { describe, it, expect, beforeEach } from 'vitest'
import { SmartSorter, DEFAULT_WEIGHTS } from '../store/SmartSorter'
import type { Task } from '../store/taskStore'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: '',
    status: 'pending',
    priority: 'medium',
    dueDate: undefined,
    createdAt: new Date().toISOString(),
    tags: [],
    ...overrides,
  }
}

describe('SmartSorter', () => {
  let sorter: SmartSorter

  beforeEach(() => {
    sorter = new SmartSorter()
  })

  describe('enable/disable', () => {
    it('starts disabled', () => {
      expect(sorter.isEnabled()).toBe(false)
    })

    it('can enable and disable', () => {
      sorter.enable()
      expect(sorter.isEnabled()).toBe(true)
      sorter.disable()
      expect(sorter.isEnabled()).toBe(false)
    })
  })

  describe('getWeights/setWeights', () => {
    it('returns default weights initially', () => {
      expect(sorter.getWeights()).toEqual(DEFAULT_WEIGHTS)
    })

    it('can set and retrieve custom weights', () => {
      const custom = { overdueDays: 20, priority: 10, createdHours: 2 }
      sorter.setWeights(custom)
      expect(sorter.getWeights()).toEqual(custom)
    })
  })

  describe('getOverdueDays', () => {
    it('returns 0 when no dueDate', () => {
      expect(sorter.getOverdueDays(makeTask())).toBe(0)
    })

    it('returns 0 for future dueDate', () => {
      const future = new Date()
      future.setDate(future.getDate() + 5)
      const task = makeTask({ dueDate: future.toISOString() })
      expect(sorter.getOverdueDays(task)).toBe(0)
    })

    it('returns positive for past dueDate', () => {
      const past = new Date()
      past.setDate(past.getDate() - 3)
      const task = makeTask({ dueDate: past.toISOString() })
      expect(sorter.getOverdueDays(task)).toBeCloseTo(3, 0)
    })
  })

  describe('calculateScore', () => {
    it('calculates score with default weights', () => {
      const past = new Date()
      past.setDate(past.getDate() - 2)
      const task = makeTask({ dueDate: past.toISOString(), priority: 'high' })
      const score = sorter.calculateScore(task)
      expect(score).toBeGreaterThan(0)
    })

    it('score increases with higher priority', () => {
      const past = new Date()
      past.setDate(past.getDate() - 1)
      const lowTask = makeTask({ dueDate: past.toISOString(), priority: 'low' })
      const highTask = makeTask({ dueDate: past.toISOString(), priority: 'high' })
      expect(sorter.calculateScore(highTask)).toBeGreaterThan(sorter.calculateScore(lowTask))
    })
  })

  describe('sortTasks', () => {
    it('sorts tasks by priority score descending', () => {
      const past = new Date()
      past.setDate(past.getDate() - 5)
      const lowPriority = makeTask({ id: 'low', priority: 'low', dueDate: past.toISOString() })
      const highPriority = makeTask({ id: 'high', priority: 'high', dueDate: past.toISOString() })

      const result = sorter.sortTasks([lowPriority, highPriority])
      expect(result[0].task.id).toBe('high')
      expect(result[0].priorityScore).toBeGreaterThan(result[1].priorityScore)
    })

    it('returns empty array for empty input', () => {
      expect(sorter.sortTasks([])).toEqual([])
    })
  })

  describe('processTasks (enabled)', () => {
    it('returns sorted tasks when enabled', () => {
      sorter.enable()
      const past = new Date()
      past.setDate(past.getDate() - 5)
      const lowPriority = makeTask({ id: 'low', priority: 'low', dueDate: past.toISOString() })
      const highPriority = makeTask({ id: 'high', priority: 'high', dueDate: past.toISOString() })

      const result = sorter.processTasks([lowPriority, highPriority])
      expect(result[0].task.id).toBe('high')
    })

    it('returns unsorted (score=0) tasks when disabled', () => {
      const result = sorter.processTasks([makeTask({ id: 'a' }), makeTask({ id: 'b' })])
      expect(result.every(r => r.priorityScore === 0)).toBe(true)
    })
  })
})
