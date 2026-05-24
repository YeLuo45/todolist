/**
 * Database schema definitions (Drizzle-style types for sql.js)
 */

export interface Task {
  id: string
  title: string
  description: string
  status: 'pending' | 'completed' | 'overdue'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  created_at: string
  completed_at: string | null
  tags: string // JSON array stored as string
}

export interface Tag {
  id: string
  name: string
  color: string // hex color
}

export interface SyncLog {
  id: number
  op: string
  entity: string
  entity_id: string
  ts: string
}

export interface TaskInsert {
  id: string
  title: string
  description: string
  status: string
  priority: string
  due_date: string | null
  created_at: string
  completed_at: string | null
  tags: string
}

export interface TagInsert {
  id: string
  name: string
  color: string
}

// Schema definition for creating tables
export const CREATE_TASKS_TABLE = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  due_date TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  tags TEXT DEFAULT '[]'
);
`

export const CREATE_TAGS_TABLE = `
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#888'
);
`

export const CREATE_SYNC_LOG_TABLE = `
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  ts TEXT NOT NULL
);
`