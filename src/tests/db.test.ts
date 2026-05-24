/**
 * V32 Database Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase, runQuery, execQuery, getOne } from '../db/index'

describe('V32 Database', () => {
  beforeAll(async () => {
    await initDatabase({ location: 'test-todolist-sqlite-db' })
  })

  afterAll(() => {
    closeDatabase()
  })

  it('should initialize SQLite database', async () => {
    const db = await initDatabase()
    expect(db).toBeDefined()
  })

  it('should create tasks table', () => {
    const result = execQuery<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'"
    )
    expect(result.length).toBe(1)
    expect(result[0].name).toBe('tasks')
  })

  it('should create tags table', () => {
    const result = execQuery<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tags'"
    )
    expect(result.length).toBe(1)
    expect(result[0].name).toBe('tags')
  })

  it('should create sync_log table', () => {
    const result = execQuery<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_log'"
    )
    expect(result.length).toBe(1)
    expect(result[0].name).toBe('sync_log')
  })

  it('should insert and query a task', () => {
    const testTask = {
      id: 'test-task-1',
      title: 'Test Task',
      description: 'Test Description',
      status: 'pending',
      priority: 'high',
      due_date: null,
      created_at: new Date().toISOString(),
      completed_at: null,
      tags: '["work"]',
    }

    runQuery(
      `INSERT INTO tasks (id, title, description, status, priority, due_date, created_at, completed_at, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testTask.id,
        testTask.title,
        testTask.description,
        testTask.status,
        testTask.priority,
        testTask.due_date,
        testTask.created_at,
        testTask.completed_at,
        testTask.tags,
      ]
    )

    const result = getOne<{ id: string; title: string }>(
      'SELECT id, title FROM tasks WHERE id = ?',
      ['test-task-1']
    )

    expect(result).toBeDefined()
    expect(result?.id).toBe('test-task-1')
    expect(result?.title).toBe('Test Task')
  })

  it('should update a task', () => {
    runQuery(
      'UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?',
      ['completed', new Date().toISOString(), 'test-task-1']
    )

    const result = getOne<{ status: string }>(
      'SELECT status FROM tasks WHERE id = ?',
      ['test-task-1']
    )

    expect(result?.status).toBe('completed')
  })

  it('should delete a task', () => {
    runQuery('DELETE FROM tasks WHERE id = ?', ['test-task-1'])

    const result = getOne<{ id: string }>(
      'SELECT id FROM tasks WHERE id = ?',
      ['test-task-1']
    )

    expect(result).toBeUndefined()
  })

  it('should insert and query a tag', () => {
    runQuery(
      'INSERT INTO tags (id, name, color) VALUES (?, ?, ?)',
      ['test-tag-1', 'Test Tag', '#FF0000']
    )

    const result = getOne<{ id: string; name: string; color: string }>(
      'SELECT id, name, color FROM tags WHERE id = ?',
      ['test-tag-1']
    )

    expect(result).toBeDefined()
    expect(result?.id).toBe('test-tag-1')
    expect(result?.name).toBe('Test Tag')
    expect(result?.color).toBe('#FF0000')
  })

  it('should log sync operations', () => {
    runQuery(
      'INSERT INTO sync_log (op, entity, entity_id, ts) VALUES (?, ?, ?, ?)',
      ['test_op', 'test_entity', 'test_id', new Date().toISOString()]
    )

    const result = getOne<{ op: string; entity: string }>(
      'SELECT op, entity FROM sync_log WHERE entity_id = ?',
      ['test_id']
    )

    expect(result?.op).toBe('test_op')
    expect(result?.entity).toBe('test_entity')
  })
})
