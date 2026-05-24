import { describe, it, expect, beforeEach } from 'vitest'
import { TaskDependencyGraph } from '../../store/TaskDependencyGraph'

describe('TaskDependencyGraph', () => {
  let graph: TaskDependencyGraph

  beforeEach(() => {
    graph = new TaskDependencyGraph()
  })

  describe('addTask / addDependency', () => {
    it('adds a task without dependencies', () => {
      graph.addTask('A')
      expect(graph.getAllTasks()).toEqual(['A'])
    })

    it('adds a dependency between two tasks', () => {
      graph.addDependency('B', 'A') // B depends on A
      expect(graph.getDependencies('B')).toEqual(['A'])
      expect(graph.getDependents('A')).toEqual(['B'])
    })

    it('allows multiple dependencies for one task', () => {
      graph.addDependency('C', 'A')
      graph.addDependency('C', 'B')
      expect(graph.getDependencies('C')).toContain('A')
      expect(graph.getDependencies('C')).toContain('B')
    })

    it('allows one task to be depended on by multiple', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'A')
      expect(graph.getDependents('A')).toContain('B')
      expect(graph.getDependents('A')).toContain('C')
    })
  })

  describe('removeDependency', () => {
    it('removes an existing dependency', () => {
      graph.addDependency('B', 'A')
      graph.removeDependency('B', 'A')
      expect(graph.getDependencies('B')).not.toContain('A')
    })

    it('returns false for non-existent dependency', () => {
      graph.addTask('A')
      graph.addTask('B')
      expect(graph.removeDependency('B', 'A')).toBe(false)
    })
  })

  describe('removeTask', () => {
    it('removes a task and its edges', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'B')
      graph.removeTask('B')
      expect(graph.getAllTasks()).not.toContain('B')
      expect(graph.getDependencies('C')).not.toContain('B')
      expect(graph.getDependents('A')).not.toContain('B')
    })
  })

  describe('getDependencies / getDependents', () => {
    it('returns empty arrays for unknown task', () => {
      expect(graph.getDependencies('X')).toEqual([])
      expect(graph.getDependents('X')).toEqual([])
    })
  })

  describe('hasCycle', () => {
    it('returns false for empty graph', () => {
      expect(graph.hasCycle()).toBe(false)
    })

    it('returns false for linear chain', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'B')
      graph.addDependency('D', 'C')
      expect(graph.hasCycle()).toBe(false)
    })

    it('returns false for diamond dependency', () => {
      // A -> B -> D
      // A -> C -> D
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'A')
      graph.addDependency('D', 'B')
      graph.addDependency('D', 'C')
      expect(graph.hasCycle()).toBe(false)
    })

    it('returns true for self-cycle', () => {
      graph.addDependency('A', 'A')
      expect(graph.hasCycle()).toBe(true)
    })

    it('returns true for simple cycle A -> B -> C -> A', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'B')
      graph.addDependency('A', 'C')
      expect(graph.hasCycle()).toBe(true)
    })

    it('returns true for cycle in subgraph', () => {
      graph.addDependency('A', 'X')
      graph.addDependency('B', 'A')
      graph.addDependency('A', 'B') // creates cycle between A and B
      expect(graph.hasCycle()).toBe(true)
    })
  })

  describe('getCycleTasks', () => {
    it('returns empty for acyclic graph', () => {
      graph.addDependency('B', 'A')
      expect(graph.getCycleTasks()).toEqual([])
    })

    it('returns tasks in a simple cycle', () => {
      graph.addDependency('A', 'B')
      graph.addDependency('B', 'A')
      const cycle = graph.getCycleTasks()
      expect(cycle).toContain('A')
      expect(cycle).toContain('B')
    })

    it('returns empty for empty graph', () => {
      expect(graph.getCycleTasks()).toEqual([])
    })
  })

  describe('topologicalSort', () => {
    it('returns single task for single node', () => {
      graph.addTask('A')
      expect(graph.topologicalSort()).toEqual(['A'])
    })

    it('returns correct order for linear chain', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'B')
      const order = graph.topologicalSort()
      expect(order!.indexOf('A')).toBeLessThan(order!.indexOf('B'))
      expect(order!.indexOf('B')).toBeLessThan(order!.indexOf('C'))
    })

    it('returns null for cyclic graph', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('A', 'B')
      expect(graph.topologicalSort()).toBe(null)
    })

    it('handles diamond dependency', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'A')
      graph.addDependency('D', 'B')
      graph.addDependency('D', 'C')
      const order = graph.topologicalSort()!
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'))
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'))
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'))
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'))
    })

    it('returns null for empty graph with no tasks', () => {
      expect(graph.topologicalSort()).toEqual([])
    })
  })

  describe('getReadyTasks', () => {
    it('returns all tasks with no dependencies when nothing completed', () => {
      graph.addDependency('B', 'A')
      const ready = graph.getReadyTasks()
      expect(ready).toContain('A')
      expect(ready).not.toContain('B')
    })

    it('returns B after A is completed', () => {
      graph.addDependency('B', 'A')
      const ready = graph.getReadyTasks(new Set(['A']))
      expect(ready).toContain('B')
    })

    it('returns multiple tasks when dependencies are met', () => {
      graph.addDependency('C', 'A')
      graph.addDependency('C', 'B')
      const ready = graph.getReadyTasks(new Set(['A', 'B']))
      expect(ready).toContain('C')
    })
  })

  describe('getNextRunnable', () => {
    it('returns tasks that can run next', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'B')
      const pending = new Set(['A', 'B', 'C'])
      const next = graph.getNextRunnable(pending)
      expect(next).toEqual(['A'])
    })
  })

  describe('getParallelBatches', () => {
    it('returns single batch for linear chain', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'B')
      const batches = graph.getParallelBatches()
      expect(batches.length).toBe(3)
      expect(batches[0].tasks).toContain('A')
      expect(batches[1].tasks).toContain('B')
      expect(batches[2].tasks).toContain('C')
    })

    it('groups parallel tasks together', () => {
      // A, B, C all independent
      graph.addTask('A')
      graph.addTask('B')
      graph.addTask('C')
      const batches = graph.getParallelBatches()
      expect(batches.length).toBe(1)
      expect(batches[0].tasks.sort()).toEqual(['A', 'B', 'C'])
    })

    it('returns empty for empty graph', () => {
      expect(graph.getParallelBatches()).toEqual([])
    })

    it('handles diamond pattern with parallel middle layer', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'A')
      graph.addDependency('D', 'B')
      graph.addDependency('D', 'C')
      const batches = graph.getParallelBatches()
      // Level 0: A, Level 1: B,C (parallel), Level 2: D
      expect(batches[0].tasks).toEqual(['A'])
      expect(batches[1].tasks.sort()).toEqual(['B', 'C'])
      expect(batches[2].tasks).toEqual(['D'])
    })
  })

  describe('getMaxParallelism', () => {
    it('returns 1 for linear chain', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'B')
      expect(graph.getMaxParallelism()).toBe(1)
    })

    it('returns 3 for 3 independent tasks', () => {
      graph.addTask('A')
      graph.addTask('B')
      graph.addTask('C')
      expect(graph.getMaxParallelism()).toBe(3)
    })

    it('returns 2 for diamond pattern', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'A')
      graph.addDependency('D', 'B')
      graph.addDependency('D', 'C')
      expect(graph.getMaxParallelism()).toBe(2) // B and C at same level
    })

    it('returns 0 for empty graph', () => {
      expect(graph.getMaxParallelism()).toBe(0)
    })
  })

  describe('markComplete / getCompletionImpact', () => {
    it('marks task complete and returns freed tasks', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'B')
      const completed = new Set<string>()
      const impact = graph.markComplete('A', completed)
      expect(completed.has('A')).toBe(true)
      expect(impact.freedTasks).toContain('B')
    })

    it('returns empty freedTasks when dependencies remain', () => {
      graph.addDependency('C', 'A')
      graph.addDependency('C', 'B')
      const completed = new Set(['A'])
      const impact = graph.getCompletionImpact('A', completed)
      expect(impact.freedTasks).not.toContain('C')
    })
  })

  describe('getDownstreamTasks', () => {
    it('returns all tasks that depend on a given task', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'B')
      const downstream = graph.getDownstreamTasks('A')
      expect(downstream).toContain('B')
      expect(downstream).toContain('C')
    })

    it('returns empty for task with no dependents', () => {
      graph.addTask('A')
      expect(graph.getDownstreamTasks('A')).toEqual([])
    })
  })

  describe('clear and size', () => {
    it('clears all tasks and edges', () => {
      graph.addDependency('B', 'A')
      graph.addDependency('C', 'A')
      graph.clear()
      expect(graph.getAllTasks()).toEqual([])
      expect(graph.size()).toBe(0)
    })

    it('reports correct edge count', () => {
      graph.addDependency('C', 'A')
      graph.addDependency('C', 'B')
      expect(graph.size()).toBe(2)
    })
  })
})