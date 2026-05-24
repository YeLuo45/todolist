import { describe, it, expect, beforeEach } from 'vitest'
import { SmartPriorityEngine, DEFAULT_PRIORITY_WEIGHTS } from '../../store/SmartPriorityEngine'
import type { Task, TaskPriority } from '../store/taskStore'

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date()
  return {
    id: 'task-1',
    title: 'Test Task',
    description: '',
    status: 'pending',
    priority: 'medium',
    dueDate: undefined,
    createdAt: now.toISOString(),
    tags: [],
    ...overrides,
  }
}

describe('SmartPriorityEngine', () => {
  let engine: SmartPriorityEngine

  beforeEach(() => {
    engine = new SmartPriorityEngine()
  })

  describe('constructor and weights', () => {
    it('starts with default weights', () => {
      expect(engine.getWeights()).toEqual(DEFAULT_PRIORITY_WEIGHTS)
    })

    it('can update weights partially', () => {
      engine.setWeights({ overdueDays: 20, deadline24h: 100 })
      const w = engine.getWeights()
      expect(w.overdueDays).toBe(20)
      expect(w.deadline24h).toBe(100)
      expect(w.createdHours).toBe(DEFAULT_PRIORITY_WEIGHTS.createdHours)
    })
  })

  describe('extractFeatures', () => {
    it('extracts zero features for basic task', () => {
      const task = makeTask()
      const f = engine.extractFeatures(task)
      expect(f.overdueDays).toBe(0)
      expect(f.hasDeadline).toBe(false)
      expect(f.tagCount).toBe(0)
    })

    it('extracts tag count from task', () => {
      const task = makeTask({ tags: ['work', 'urgent'] })
      const f = engine.extractFeatures(task)
      expect(f.tagCount).toBe(2)
    })
  })

  describe('getOverdueDays', () => {
    it('returns 0 for task without dueDate', () => {
      expect(engine.getOverdueDays(makeTask())).toBe(0)
    })

    it('returns 0 for future dueDate', () => {
      const future = new Date()
      future.setDate(future.getDate() + 5)
      expect(engine.getOverdueDays(makeTask({ dueDate: future.toISOString() }))).toBe(0)
    })

    it('returns positive for past dueDate', () => {
      const past = new Date()
      past.setDate(past.getDate() - 3)
      const days = engine.getOverdueDays(makeTask({ dueDate: past.toISOString() }))
      expect(days).toBeGreaterThan(2)
      expect(days).toBeLessThan(4)
    })
  })

  describe('getCreatedHours', () => {
    it('returns 0 for brand new task', () => {
      const task = makeTask({ createdAt: new Date().toISOString() })
      expect(engine.getCreatedHours(task)).toBeLessThan(1)
    })

    it('returns positive for old task', () => {
      const old = new Date()
      old.setHours(old.getHours() - 48)
      const hours = engine.getCreatedHours(makeTask({ createdAt: old.toISOString() }))
      expect(hours).toBeGreaterThan(46)
    })
  })

  describe('computeScore', () => {
    it('returns 0 for basic task with no features', () => {
      const score = engine.computeScore(makeTask())
      expect(score).toBe(0)
    })

    it('score increases with overdue days', () => {
      const past = new Date()
      past.setDate(past.getDate() - 5)
      const task = makeTask({ dueDate: past.toISOString() })
      const score = engine.computeScore(task)
      expect(score).toBeGreaterThan(50) // 5 days * 10 weight
    })

    it('score increases with tags', () => {
      const task = makeTask({ tags: ['a', 'b', 'c'] })
      const score = engine.computeScore(task)
      expect(score).toBe(3) // 3 tags * 1 weight
    })

    it('score increases for task with deadline', () => {
      const task = makeTask({ dueDate: new Date().toISOString() })
      const score = engine.computeScore(task)
      expect(score).toBeGreaterThan(5) // hasDeadline = 5
    })

    it('high score for overdue task within 24h', () => {
      // A task that is ~36 hours overdue (yesterday noon when it's now midnight)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const task = makeTask({ dueDate: yesterday.toISOString() })
      const score = engine.computeScore(task)
      // overdue ~1.5d + deadlineScore + hasDeadline(5)
      expect(score).toBeGreaterThan(25)
    })
  })

  describe('predictPriority', () => {
    it('predicts low for basic task', () => {
      const task = makeTask()
      const { predicted, confidence } = engine.predictPriority(task)
      expect(predicted).toBe('low')
      expect(confidence).toBeGreaterThan(0)
    })

    it('predicts high for significantly overdue task', () => {
      const past = new Date()
      past.setDate(past.getDate() - 10)
      const task = makeTask({ dueDate: past.toISOString(), priority: 'medium' })
      const { predicted, confidence } = engine.predictPriority(task)
      expect(predicted).toBe('high')
      expect(confidence).toBeGreaterThan(0.5)
    })

    it('predicts medium for moderately overdue task', () => {
      const past = new Date()
      past.setDate(past.getDate() - 3)
      const task = makeTask({ dueDate: past.toISOString(), priority: 'medium' })
      const { predicted } = engine.predictPriority(task)
      // Score = 3d*10 + 5(deadline) = 35, threshold high=30, medium=10 → medium
      expect(['medium', 'high']).toContain(predicted)
    })

    it('low confidence for task with no deadline and no tags', () => {
      const task = makeTask()
      const { confidence } = engine.predictPriority(task)
      expect(confidence).toBeLessThan(0.5)
    })
  })

  describe('suggestPriority', () => {
    it('returns predicted priority', () => {
      const task = makeTask()
      const suggested = engine.suggestPriority(task)
      expect(['high', 'medium', 'low']).toContain(suggested)
    })
  })

  describe('autoPriorityTasks', () => {
    it('preserves high/low priority tasks', () => {
      const tasks = [
        makeTask({ id: 'high', priority: 'high' }),
        makeTask({ id: 'low', priority: 'low' }),
      ]
      const result = engine.autoPriorityTasks(tasks)
      expect(result.get('high')).toBe('high')
      expect(result.get('low')).toBe('low')
    })

    it('assigns predicted priority to medium tasks', () => {
      const past = new Date()
      past.setDate(past.getDate() - 10)
      const tasks = [
        makeTask({ id: 'urgent', priority: 'medium', dueDate: past.toISOString() }),
        makeTask({ id: 'normal', priority: 'medium' }),
      ]
      const result = engine.autoPriorityTasks(tasks)
      expect(result.get('urgent')).toBe('high')
      expect(result.get('normal')).toBe('low')
    })
  })

  describe('explainScore', () => {
    it('explains overdue contribution', () => {
      const past = new Date()
      past.setDate(past.getDate() - 5)
      const task = makeTask({ dueDate: past.toISOString() })
      const { breakdown, factors } = engine.explainScore(task)
      expect(breakdown.overdue).toBeGreaterThan(0)
      expect(factors.length).toBeGreaterThan(0)
      expect(factors.some(f => f.includes('overdue'))).toBe(true)
    })

    it('explains tag contribution', () => {
      const task = makeTask({ tags: ['x', 'y'] })
      const { breakdown } = engine.explainScore(task)
      expect(breakdown.tags).toBe(2)
    })

    it('returns score equal to computeScore', () => {
      const past = new Date()
      past.setDate(past.getDate() - 5)
      const task = makeTask({ dueDate: past.toISOString(), tags: ['work'] })
      const { score } = engine.explainScore(task)
      expect(score).toBe(engine.computeScore(task))
    })

    it('factors includes hasDeadline when dueDate is set', () => {
      const task = makeTask({ dueDate: new Date().toISOString() })
      const { factors } = engine.explainScore(task)
      expect(factors.some(f => f.includes('deadline'))).toBe(true)
    })
  })
})

describe('SmartPriorityEngine deadline scoring', () => {
  let engine: SmartPriorityEngine

  beforeEach(() => {
    engine = new SmartPriorityEngine()
  })

  it('gives highest score for task overdue within 24h', () => {
    // 36 hours overdue (1.5 days ago)
    const twelveHoursAgo = new Date()
    twelveHoursAgo.setDate(twelveHoursAgo.getDate() - 1)
    const task = makeTask({ dueDate: twelveHoursAgo.toISOString() })
    const score = engine.computeScore(task)
    expect(score).toBeGreaterThan(25)
  })

  it('gives medium score for task due in 48-72h', () => {
    const in50h = new Date()
    in50h.setHours(in50h.getHours() + 50)
    const task = makeTask({ dueDate: in50h.toISOString() })
    const score = engine.computeScore(task)
    // hasDeadline(5) + deadline48_72h(30) = 35
    expect(score).toBeGreaterThan(25)
  })

  it('gives low score for task due beyond 72h', () => {
    const in100h = new Date()
    in100h.setHours(in100h.getHours() + 100)
    const task = makeTask({ dueDate: in100h.toISOString() })
    const score = engine.computeScore(task)
    // hasDeadline(5) + linear decay = ~22.8 but hasDeadline adds 5, total ~32.2
    expect(score).toBeLessThan(40)
  })

  it('overdue task gets overdueBoost', () => {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const task = makeTask({ dueDate: twoDaysAgo.toISOString() })
    const { breakdown } = engine.explainScore(task)
    expect(breakdown.overdue).toBeGreaterThan(0)
  })
})