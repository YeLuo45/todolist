/**
 * SmartSorter - Registry-driven priority scoring engine
 * Inspired by nanobot-design ToolRegistry pattern
 */

import type { Task, TaskPriority } from './taskStore'

export interface PriorityWeights {
  overdueDays: number    // w1: 逾期天数权重
  priority: number       // w2: 优先级权重
  createdHours: number   // w3: 创建时间权重
  deadline: number       // w4: 截止日期临近权重
}

export interface ScoredTask {
  task: Task
  priorityScore: number
  overdueDays: number
}

export type CustomScorer = (task: Task) => number

// Default weights (nanobot-design inspired)
export const DEFAULT_WEIGHTS: PriorityWeights = {
  overdueDays: 10,
  priority: 5,
  createdHours: 0.1,
  deadline: 0,
}

const PRIORITY_WEIGHT_MAP: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export class SmartSorter {
  private weights: PriorityWeights
  private enabled: boolean = false

  constructor(weights: PriorityWeights = DEFAULT_WEIGHTS) {
    this.weights = weights
  }

  setWeights(weights: PriorityWeights) {
    this.weights = weights
  }

  getWeights(): PriorityWeights {
    return { ...this.weights }
  }

  enable() {
    this.enabled = true
  }

  disable() {
    this.enabled = false
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Calculate priority score for a single task
   * Formula: w1 * overdueDays + w2 * priorityWeight + w3 * createdHours
   */
  calculateScore(task: Task): number {
    const overdueDays = this.getOverdueDays(task)
    const priorityWeight = PRIORITY_WEIGHT_MAP[task.priority]
    const createdHours = this.getCreatedHours(task)

    return (
      this.weights.overdueDays * overdueDays +
      this.weights.priority * priorityWeight +
      this.weights.createdHours * createdHours
    )
  }

  /**
   * Get days overdue (0 if not overdue)
   */
  getOverdueDays(task: Task): number {
    if (!task.dueDate) return 0
    const now = new Date()
    const due = new Date(task.dueDate)
    const diffMs = now.getTime() - due.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return Math.max(0, diffDays)
  }

  /**
   * Get hours since task creation
   */
  getCreatedHours(task: Task): number {
    const created = new Date(task.createdAt)
    const now = new Date()
    return (now.getTime() - created.getTime()) / (1000 * 60 * 60)
  }

  /**
   * Score all tasks and sort by priority score descending
   */
  sortTasks(tasks: Task[]): ScoredTask[] {
    return tasks
      .map(task => ({
        task,
        priorityScore: this.calculateScore(task),
        overdueDays: this.getOverdueDays(task),
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore)
  }

  /**
   * Filter tasks and sort (main entry point for TaskList)
   * Returns sorted tasks if enabled, original array if disabled
   */
  processTasks(tasks: Task[]): ScoredTask[] {
    if (!this.enabled) {
      // Return in original order when disabled
      return tasks.map(task => ({
        task,
        priorityScore: 0,
        overdueDays: this.getOverdueDays(task),
      }))
    }
    return this.sortTasks(tasks)
  }

  /**
   * Sort tasks by deadline proximity (most urgent first)
   * Tasks without deadline are placed at the end
   */
  sortByDeadline(tasks: Task[], beforeDate: Date = new Date()): ScoredTask[] {
    return tasks
      .map(task => ({
        task,
        priorityScore: this.getDeadlineScore(task, beforeDate),
        overdueDays: this.getOverdueDays(task),
      }))
      .sort((a, b) => {
        // Tasks without deadline go last
        if (a.task.dueDate === undefined && b.task.dueDate === undefined) return 0
        if (a.task.dueDate === undefined) return 1
        if (b.task.dueDate === undefined) return -1
        return b.priorityScore - a.priorityScore  // descending: highest score first
      })
  }

  /**
   * Calculate deadline proximity score
   * Higher score = more urgent (closer to deadline)
   */
  private getDeadlineScore(task: Task, beforeDate: Date): number {
    if (!task.dueDate) return 0
    const now = beforeDate.getTime()
    const due = new Date(task.dueDate).getTime()
    const diffHours = (due - now) / (1000 * 60 * 60)
    // Score: high when within 48 hours, decreasing linearly
    if (diffHours < 0) return 100 + Math.abs(diffHours) // Overdue: highest scores
    if (diffHours > 48) return 0
    return (48 - diffHours) * this.weights.deadline
  }

  /**
   * Detect "unsorted zone" tasks - tasks with no tags and no category
   * These tasks have nowhere to land in a organized task list
   */
  detectUnsortedZone(tasks: Task[]): Task[] {
    return tasks.filter(task => {
      const hasNoTags = !task.tags || task.tags.length === 0
      const hasNoCategory = !task.category || task.category.trim() === ''
      const hasNoPriority = !task.priority || task.priority === 'medium'
      return hasNoTags && hasNoCategory && hasNoPriority
    })
  }

  /**
   * Update weights at runtime
   */
  updateWeights(weights: Partial<PriorityWeights>): void {
    this.weights = { ...this.weights, ...weights }
  }

  /**
   * Sort tasks using a custom scorer function
   */
  sortWithCustomScorer(tasks: Task[], scorer: CustomScorer): ScoredTask[] {
    return tasks
      .map(task => ({
        task,
        priorityScore: scorer(task),
        overdueDays: this.getOverdueDays(task),
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore)
  }
}

// Singleton instance (shared across components)
export const smartSorter = new SmartSorter()