/**
 * TaskDependencyGraph - DAG-based task dependency management
 * Inspired by nanobot-design TaskRegistry pattern
 */

export interface DependencyEdge {
  from: string   // task that depends on another
  to: string      // task it depends on (must complete first)
}

export interface ParallelBatch {
  level: number
  tasks: string[]
}

export interface CompletionImpact {
  freedTasks: string[]    // tasks that become runnable after this completes
  downstreamTasks: string[]  // all tasks transitively depending on this
}

export class TaskDependencyGraph {
  // adjacency list: taskId -> tasks it depends on (outgoing edges from taskId to its dependencies)
  private dependencies: Map<string, Set<string>> = new Map()
  // reverse adjacency: taskId -> tasks that depend on it
  private dependents: Map<string, Set<string>> = new Map()
  // track all tasks involved in the graph
  private allTasks: Set<string> = new Set()

  constructor() {}

  /**
   * Add a task to the graph (no dependencies yet)
   */
  addTask(taskId: string): void {
    if (!this.dependencies.has(taskId)) {
      this.dependencies.set(taskId, new Set())
    }
    if (!this.dependents.has(taskId)) {
      this.dependents.set(taskId, new Set())
    }
    this.allTasks.add(taskId)
  }

  /**
   * Add a dependency: taskId depends on dependsOn
   * (taskId cannot run until dependsOn completes)
   */
  addDependency(taskId: string, dependsOn: string): void {
    this.addTask(taskId)
    this.addTask(dependsOn)
    this.dependencies.get(taskId)!.add(dependsOn)
    this.dependents.get(dependsOn)!.add(taskId)
  }

  /**
   * Remove a dependency relationship
   */
  removeDependency(taskId: string, dependsOn: string): boolean {
    const deps = this.dependencies.get(taskId)
    if (!deps) return false
    const deleted = deps.delete(dependsOn)
    if (deleted) {
      this.dependents.get(dependsOn)?.delete(taskId)
    }
    return deleted
  }

  /**
   * Remove a task entirely from the graph
   */
  removeTask(taskId: string): void {
    // Remove this task from all dependencies
    const deps = this.dependencies.get(taskId)
    if (deps) {
      for (const dep of deps) {
        this.dependents.get(dep)?.delete(taskId)
      }
    }
    // Remove tasks that depend on this one
    const rev = this.dependents.get(taskId)
    if (rev) {
      for (const r of rev) {
        this.dependencies.get(r)?.delete(taskId)
      }
    }
    this.dependencies.delete(taskId)
    this.dependents.delete(taskId)
    this.allTasks.delete(taskId)
  }

  /**
   * Get direct dependencies of a task (what this task must wait for)
   */
  getDependencies(taskId: string): string[] {
    return Array.from(this.dependencies.get(taskId) ?? [])
  }

  /**
   * Get tasks that depend on this task (what waits for this task)
   */
  getDependents(taskId: string): string[] {
    return Array.from(this.dependents.get(taskId) ?? [])
  }

  /**
   * Get all tasks in the graph
   */
  getAllTasks(): string[] {
    return Array.from(this.allTasks)
  }

  /**
   * Check if adding a dependency would create a cycle
   */
  private wouldCreateCycle(taskId: string, dependsOn: string): boolean {
    // If dependsOn transitively depends on taskId, adding this edge creates a cycle
    const visited = new Set<string>()
    const stack = [dependsOn]
    while (stack.length > 0) {
      const current = stack.pop()!
      if (current === taskId) return true
      if (visited.has(current)) continue
      visited.add(current)
      const deps = this.dependencies.get(current)
      if (deps) {
        for (const dep of deps) {
          stack.push(dep)
        }
      }
    }
    return false
  }

  /**
   * Detect if there's any cycle in the graph
   */
  hasCycle(): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const dfs = (node: string): boolean => {
      visited.add(node)
      recursionStack.add(node)
      const deps = this.dependencies.get(node)
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            if (dfs(dep)) return true
          } else if (recursionStack.has(dep)) {
            return true
          }
        }
      }
      recursionStack.delete(node)
      return false
    }

    for (const task of this.allTasks) {
      if (!visited.has(task)) {
        if (dfs(task)) return true
      }
    }
    return false
  }

  /**
   * Get tasks that are part of a cycle
   */
  getCycleTasks(): string[] {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const cycleTasks: string[] = []

    const dfs = (node: string): boolean => {
      visited.add(node)
      recursionStack.add(node)
      const deps = this.dependencies.get(node)
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            if (dfs(dep)) {
              if (recursionStack.has(dep)) {
                cycleTasks.push(dep)
              }
              return true
            }
          } else if (recursionStack.has(dep)) {
            cycleTasks.push(dep)
            cycleTasks.push(node)
            return true
          }
        }
      }
      recursionStack.delete(node)
      return false
    }

    for (const task of this.allTasks) {
      if (!visited.has(task)) {
        dfs(task)
      }
    }
    return [...new Set(cycleTasks)]
  }

  /**
   * Kahn's algorithm topological sort
   * Returns tasks in execution order (dependencies first)
   */
  topologicalSort(): string[] | null {
    if (this.hasCycle()) return null

    const inDegree = new Map<string, number>()
    // Initialize in-degree for all tasks
    for (const task of this.allTasks) {
      inDegree.set(task, 0)
    }
    // Calculate in-degree (number of dependencies each task has)
    for (const [, deps] of this.dependencies) {
      for (const dep of deps) {
        inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1)
      }
    }

    // Queue of tasks with no dependencies
    const queue: string[] = []
    for (const [task, degree] of inDegree) {
      if (degree === 0) queue.push(task)
    }

    const result: string[] = []
    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(current)
      // For each task that depends on current, reduce its in-degree
      const rev = this.dependents.get(current)
      if (rev) {
        for (const dependent of rev) {
          const newDegree = (inDegree.get(dependent) ?? 1) - 1
          inDegree.set(dependent, newDegree)
          if (newDegree === 0) {
            queue.push(dependent)
          }
        }
      }
    }

    // If not all tasks are in result, there's a cycle (shouldn't happen due to check above)
    if (result.length !== this.allTasks.size) return null
    return result
  }

  /**
   * Get tasks with no pending dependencies (can run now)
   */
  getReadyTasks(completedTasks: Set<string> = new Set()): string[] {
    const ready: string[] = []
    for (const task of this.allTasks) {
      if (completedTasks.has(task)) continue
      const deps = this.dependencies.get(task)
      if (!deps) {
        ready.push(task)
        continue
      }
      const allDepsDone = Array.from(deps).every(d => completedTasks.has(d))
      if (allDepsDone) {
        ready.push(task)
      }
    }
    return ready
  }

  /**
   * Get tasks that will become runnable given a set of pending tasks
   */
  getNextRunnable(pendingTasks: Set<string>): string[] {
    const nonPending = new Set([...this.allTasks].filter(t => !pendingTasks.has(t)))
    return this.getReadyTasks(nonPending)
  }

  /**
   * Get parallel execution batches (tasks at same level can run in parallel)
   * Returns tasks grouped by their topological level
   */
  getParallelBatches(): ParallelBatch[] {
    if (this.hasCycle()) return []

    const batches: ParallelBatch[] = []
    const completed = new Set<string>()
    let level = 0

    while (completed.size < this.allTasks.size) {
      const ready = this.getReadyTasks(completed)
      if (ready.length === 0) break  // Shouldn't happen if no cycle

      batches.push({ level, tasks: ready })
      for (const task of ready) {
        completed.add(task)
      }
      level++
    }

    return batches
  }

  /**
   * Maximum number of tasks that can run in parallel at any level
   */
  getMaxParallelism(): number {
    const batches = this.getParallelBatches()
    if (batches.length === 0) return 0
    return Math.max(...batches.map(b => b.tasks.length))
  }

  /**
   * Mark a task as complete and get the impact
   */
  markComplete(taskId: string, completedTasks: Set<string>): CompletionImpact {
    completedTasks.add(taskId)
    return this.getCompletionImpact(taskId, completedTasks)
  }

  /**
   * Get tasks freed by completing a specific task
   */
  getCompletionImpact(taskId: string, completedTasks: Set<string>): CompletionImpact {
    const freedTasks: string[] = []
    const downstreamTasks = this.getDownstreamTasks(taskId)

    for (const downstream of downstreamTasks) {
      if (completedTasks.has(downstream)) continue
      const deps = this.dependencies.get(downstream)
      if (!deps) {
        freedTasks.push(downstream)
        continue
      }
      const allDepsDone = Array.from(deps).every(d => completedTasks.has(d))
      if (allDepsDone) {
        freedTasks.push(downstream)
      }
    }

    return { freedTasks, downstreamTasks }
  }

  /**
   * Get all tasks that transitively depend on taskId
   */
  getDownstreamTasks(taskId: string): string[] {
    const result: string[] = []
    const visited = new Set<string>()
    const stack = [taskId]

    while (stack.length > 0) {
      const current = stack.pop()!
      const rev = this.dependents.get(current)
      if (rev) {
        for (const dep of rev) {
          if (!visited.has(dep)) {
            visited.add(dep)
            result.push(dep)
            stack.push(dep)
          }
        }
      }
    }
    return result
  }

  /**
   * Clear the entire graph
   */
  clear(): void {
    this.dependencies.clear()
    this.dependents.clear()
    this.allTasks.clear()
  }

  /**
   * Get the number of edges in the graph
   */
  size(): number {
    let count = 0
    for (const [, deps] of this.dependencies) {
      count += deps.size
    }
    return count
  }
}