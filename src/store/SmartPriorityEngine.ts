/**
 * SmartPriorityEngine - AI-driven priority prediction engine
 * Inspired by nanobot-design pattern recognition
 */

import type { Task, TaskPriority } from './taskStore'

export interface PriorityFeature {
  overdueDays: number
  createdHours: number
  tagCount: number
  hasDeadline: boolean
  repeatPattern: number    // 0=none, 1=daily, 2=weekly, 3=monthly
  categoryMatch: number    // 0-10 score for category matching
}

export interface PriorityPrediction {
  predicted: TaskPriority
  confidence: number      // 0-1
}

export interface ScoreBreakdown {
  score: number
  breakdown: Record<string, number>
  factors: string[]
}

// Feature weights (configurable)
export interface PriorityWeights {
  overdueDays: number
  createdHours: number
  tagCount: number
  hasDeadline: number
  repeatPattern: number
  categoryMatch: number
  deadline24h: number
  deadline48_72h: number
  overdueBoost: number
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  overdueDays: 10,
  createdHours: 0.05,
  tagCount: 1,
  hasDeadline: 5,
  repeatPattern: 20,
  categoryMatch: 2,
  deadline24h: 50,
  deadline48_72h: 30,
  overdueBoost: 15,
}

const PRIORITY_THRESHOLDS = {
  high: 30,
  medium: 10,
  low: 0,
}

export class SmartPriorityEngine {
  private weights: PriorityWeights

  constructor(weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS) {
    this.weights = weights
  }

  setWeights(weights: Partial<PriorityWeights>) {
    this.weights = { ...this.weights, ...weights }
  }

  getWeights(): PriorityWeights {
    return { ...this.weights }
  }

  /**
   * Extract feature vector from a task
   */
  extractFeatures(task: Task): PriorityFeature {
    const overdueDays = this.getOverdueDays(task)
    const createdHours = this.getCreatedHours(task)
    const tagCount = task.tags?.length ?? 0
    const hasDeadline = !!task.dueDate
    const repeatPattern = 0  // TODO: implement repeat pattern detection from metadata
    const categoryMatch = 0  // TODO: implement category matching

    return { overdueDays, createdHours, tagCount, hasDeadline, repeatPattern, categoryMatch }
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
   * Calculate deadline urgency score
   */
  private getDeadlineScore(task: Task): number {
    if (!task.dueDate) return 0
    const now = new Date()
    const due = new Date(task.dueDate)
    const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (diffHours < 0) {
      // Overdue: boost based on how overdue
      return this.weights.overdueBoost + Math.min(Math.abs(diffHours) * 0.5, 50)
    }
    if (diffHours <= 24) {
      return this.weights.deadline24h
    }
    if (diffHours <= 72) {
      return this.weights.deadline48_72h
    }
    // Beyond 72h: linear decay from 30 down to 0
    return Math.max(0, 30 - (diffHours - 72) * 0.1)
  }

  /**
   * Compute raw priority score from features
   */
  computeScore(task: Task): number {
    const features = this.extractFeatures(task)
    let score = 0

    // Overdue days (strongest factor)
    score += this.weights.overdueDays * features.overdueDays

    // Created hours (recency factor)
    score += this.weights.createdHours * features.createdHours

    // Tag count (well-tagged = important)
    score += this.weights.tagCount * features.tagCount

    // Has deadline (deadline = commitment)
    if (features.hasDeadline) {
      score += this.weights.hasDeadline
    }

    // Repeat pattern (habit = important)
    score += this.weights.repeatPattern * features.repeatPattern

    // Category match
    score += this.weights.categoryMatch * features.categoryMatch

    // Deadline urgency
    score += this.getDeadlineScore(task)

    return score
  }

  /**
   * Predict priority from task features (when priority field is missing/medium)
   */
  predictPriority(task: Task): PriorityPrediction {
    const score = this.computeScore(task)

    let predicted: TaskPriority
    let confidence: number

    if (score >= PRIORITY_THRESHOLDS.high) {
      predicted = 'high'
      confidence = Math.min(1, 0.5 + (score - PRIORITY_THRESHOLDS.high) / 50)
    } else if (score >= PRIORITY_THRESHOLDS.medium) {
      predicted = 'medium'
      confidence = Math.min(1, 0.5 + (score - PRIORITY_THRESHOLDS.medium) / 30)
    } else {
      predicted = 'low'
      confidence = Math.min(1, 0.3 + score / 30)
    }

    // Low confidence when task has no deadline and few tags
    const features = this.extractFeatures(task)
    if (!features.hasDeadline && features.tagCount === 0) {
      confidence *= 0.6
    }

    return { predicted, confidence }
  }

  /**
   * Suggest a priority for a task (alias for predictPriority)
   */
  suggestPriority(task: Task): TaskPriority {
    return this.predictPriority(task).predicted
  }

  /**
   * Auto-assign priorities to a batch of tasks
   * Only assigns to tasks with implicit/medium priority
   */
  autoPriorityTasks(tasks: Task[]): Map<string, TaskPriority> {
    const results = new Map<string, TaskPriority>()

    for (const task of tasks) {
      // Skip tasks that already have explicit high/low priority
      if (task.priority === 'high' || task.priority === 'low') {
        results.set(task.id, task.priority)
        continue
      }

      // Predict for medium or undefined
      const prediction = this.predictPriority(task)
      results.set(task.id, prediction.predicted)
    }

    return results
  }

  /**
   * Explain why a task got its score
   */
  explainScore(task: Task): ScoreBreakdown {
    const features = this.extractFeatures(task)
    const breakdown: Record<string, number> = {}
    const factors: string[] = []

    // Overdue
    if (features.overdueDays > 0) {
      breakdown.overdue = this.weights.overdueDays * features.overdueDays
      factors.push(`${features.overdueDays.toFixed(1)}d overdue × ${this.weights.overdueDays}`)
    }

    // Deadline urgency
    const deadlineScore = this.getDeadlineScore(task)
    if (deadlineScore > 0) {
      breakdown.deadline = deadlineScore
      factors.push(`deadline urgency +${deadlineScore.toFixed(0)}`)
    }

    // Created hours
    if (features.createdHours > 0) {
      breakdown.recency = this.weights.createdHours * features.createdHours
      factors.push(`${features.createdHours.toFixed(0)}h old × ${this.weights.createdHours}`)
    }

    // Tags
    if (features.tagCount > 0) {
      breakdown.tags = this.weights.tagCount * features.tagCount
      factors.push(`${features.tagCount} tags × ${this.weights.tagCount}`)
    }

    // Has deadline
    if (features.hasDeadline) {
      breakdown.hasDeadline = this.weights.hasDeadline
      factors.push(`has deadline +${this.weights.hasDeadline}`)
    }

    // Repeat pattern
    if (features.repeatPattern > 0) {
      breakdown.repeat = this.weights.repeatPattern * features.repeatPattern
      factors.push(`repeat pattern ×${features.repeatPattern}`)
    }

    // Category match
    if (features.categoryMatch > 0) {
      breakdown.category = this.weights.categoryMatch * features.categoryMatch
      factors.push(`category match +${features.categoryMatch}`)
    }

    const score = this.computeScore(task)
    return { score, breakdown, factors }
  }
}

// Singleton instance
export const smartPriorityEngine = new SmartPriorityEngine()