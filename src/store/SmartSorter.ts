/**
 * SmartSorter - Registry-driven priority scoring engine
 * Inspired by nanobot-design ToolRegistry pattern
 */

import type { Task, TaskPriority } from './taskStore'

export interface PriorityWeights {
  overdueDays: number    // w1: 逾期天数权重
  priority: number       // w2: 优先级权重
  createdHours: number   // w3: 创建时间权重
}

export interface ScoredTask {
  task: Task
  priorityScore: number
  overdueDays: number
}

// Default weights (nanobot-design inspired)
export const DEFAULT_WEIGHTS: PriorityWeights = {
  overdueDays: 10,
  priority: 5,
  createdHours: 0.1,
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
}

// Singleton instance (shared across components)
export const smartSorter = new SmartSorter()