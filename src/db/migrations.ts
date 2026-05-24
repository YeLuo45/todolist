/**
 * Data migrations from localStorage to SQLite
 */

import { getDatabase, execQuery } from './index'
import type { Task, Tag, TaskInsert, TagInsert } from './schema'
import { logSync } from './index'

const LEGACY_TASK_KEY = 'todolist-tasks'
const LEGACY_TAG_KEY = 'todolist-tags'

interface LegacyTask {
  id: string
  title: string
  description: string
  status: 'pending' | 'completed' | 'overdue'
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  createdAt: string
  completedAt?: string
  tags: string[]
}

interface LegacyTag {
  id: string
  name: string
  colorIndex: number
}

/**
 * Check if migration has already been done
 */
export function isMigrated(): boolean {
  try {
    const result = execQuery<{ count: number }>('SELECT COUNT(*) as count FROM sync_log WHERE op = ?', ['migrate'])
    return (result[0]?.count ?? 0) > 0
  } catch {
    return false
  }
}

/**
 * Migrate all data from localStorage to SQLite
 */
export async function migrateFromLegacy(): Promise<{ tasks: number; tags: number }> {
  const db = getDatabase()

  // Migrate tasks
  const legacyTasksRaw = localStorage.getItem(LEGACY_TASK_KEY)
  let taskCount = 0
  if (legacyTasksRaw) {
    try {
      const legacyTasks: LegacyTask[] = JSON.parse(legacyTasksRaw)
      for (const task of legacyTasks) {
        const taskInsert: TaskInsert = {
          id: task.id,
          title: task.title,
          description: task.description || '',
          status: task.status,
          priority: task.priority,
          due_date: task.dueDate || null,
          created_at: task.createdAt,
          completed_at: task.completedAt || null,
          tags: JSON.stringify(task.tags || []),
        }
        db.run(
          `INSERT OR REPLACE INTO tasks (id, title, description, status, priority, due_date, created_at, completed_at, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            taskInsert.id,
            taskInsert.title,
            taskInsert.description,
            taskInsert.status,
            taskInsert.priority,
            taskInsert.due_date,
            taskInsert.created_at,
            taskInsert.completed_at,
            taskInsert.tags,
          ]
        )
        taskCount++
      }
    } catch (e) {
      console.error('Failed to migrate tasks:', e)
    }
  }

  // Migrate tags
  const legacyTagsRaw = localStorage.getItem(LEGACY_TAG_KEY)
  let tagCount = 0
  if (legacyTagsRaw) {
    try {
      const legacyTags: LegacyTag[] = JSON.parse(legacyTagsRaw)
      const TAG_COLORS = [
        '#FFE4E4', '#FFF4E4', '#FFF9E4', '#E8F5E9',
        '#E3F2FD', '#EDE7F6', '#FCE4EC', '#ECEFF1',
      ]
      for (const tag of legacyTags) {
        const color = TAG_COLORS[tag.colorIndex % TAG_COLORS.length] || '#888'
        const tagInsert: TagInsert = {
          id: tag.id,
          name: tag.name,
          color,
        }
        db.run(
          `INSERT OR REPLACE INTO tags (id, name, color) VALUES (?, ?, ?)`,
          [tagInsert.id, tagInsert.name, tagInsert.color]
        )
        tagCount++
      }
    } catch (e) {
      console.error('Failed to migrate tags:', e)
    }
  }

  // Mark migration as complete
  logSync('migrate', 'all', 'legacy-migration')

  // Clear legacy localStorage keys
  localStorage.removeItem(LEGACY_TASK_KEY)
  localStorage.removeItem(LEGACY_TAG_KEY)

  return { tasks: taskCount, tags: tagCount }
}

/**
 * Load all tasks from SQLite
 */
export function loadTasksFromDb(): Task[] {
  return execQuery<Task>('SELECT * FROM tasks ORDER BY created_at DESC')
}

/**
 * Load all tags from SQLite
 */
export function loadTagsFromDb(): Tag[] {
  return execQuery<Tag>('SELECT * FROM tags ORDER BY id')
}
