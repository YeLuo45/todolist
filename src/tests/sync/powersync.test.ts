/**
 * PowerSync Delta Sync Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PowerSync } from '../../sync/powersync'
import type { SyncDelta } from '../../sync/powersync'
import { SQLiteStore } from '../../db/sqlite-store'

function clearTestKeys(): void {
  const toDelete: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('sqlite-kv:')) {
      toDelete.push(key)
    }
  }
  for (const key of toDelete) {
    localStorage.removeItem(key)
  }
}

describe('PowerSync', () => {
  let store: SQLiteStore
  let ps: PowerSync

  beforeEach(async () => {
    clearTestKeys()
    store = new SQLiteStore()
    await store.init()
    ps = new PowerSync(store, 'test-client')
  })

  afterEach(() => {
    clearTestKeys()
  })

  it('should initialize with zero vector clock', () => {
    expect(ps.getVectorClock()).toBe(0)
  })

  it('should record operations', () => {
    ps.recordOp({ table: 'tasks', operation: 'INSERT', id: 't1', data: { title: 'Test' }, timestamp: Date.now() })
    expect(ps.getPendingOps().length).toBe(1)
  })

  it('should generate delta and increment vector clock', () => {
    ps.recordOp({ table: 'tasks', operation: 'INSERT', id: 't1', data: { title: 'Test' }, timestamp: Date.now() })
    ps.recordOp({ table: 'tasks', operation: 'UPDATE', id: 't2', data: { title: 'T2' }, timestamp: Date.now() })

    const delta = ps.generateDelta()

    expect(delta.clientId).toBe('test-client')
    expect(delta.vectorClock).toBe(1) // one delta generated
    expect(delta.changes.length).toBe(2)
    expect(ps.getVectorClock()).toBe(1)
  })

  it('should clear pending ops after generateDelta', () => {
    ps.recordOp({ table: 'tasks', operation: 'INSERT', id: 't1', data: {}, timestamp: Date.now() })
    ps.generateDelta()
    ps.clearPendingOps()

    expect(ps.getPendingOps().length).toBe(0)
  })

  it('should apply delta with INSERT on empty store', async () => {
    const delta: SyncDelta = {
      clientId: 'remote',
      vectorClock: 1,
      changes: [
        { table: 'tasks', operation: 'INSERT', id: 't1', data: { title: 'Remote Task', updatedAt: 100 }, timestamp: Date.now() },
      ],
      timestamp: Date.now(),
    }

    const { applied, conflicts } = await ps.applyDelta(delta)

    expect(applied).toBe(1)
    expect(conflicts).toBe(0)
    const val = await store.get('tasks:t1')
    expect((val as { title: string }).title).toBe('Remote Task')
  })

  it('should detect conflict on UPDATE when local record exists', async () => {
    // Pre-populate local store
    await store.put('tasks:t1', { title: 'Local Task', updatedAt: 200, tags: ['local'] })

    const delta: SyncDelta = {
      clientId: 'remote',
      vectorClock: 1,
      changes: [
        { table: 'tasks', operation: 'UPDATE', id: 't1', data: { title: 'Remote Task', updatedAt: 100, tags: ['remote'] }, timestamp: Date.now() },
      ],
      timestamp: Date.now(),
    }

    const { applied, conflicts } = await ps.applyDelta(delta)

    expect(applied).toBe(1)
    expect(conflicts).toBe(1)
    // Last-write-wins: local updatedAt 200 > remote updatedAt 100, so local wins
    const val = await store.get<{ title: string; tags: string[] }>('tasks:t1')
    expect(val?.title).toBe('Local Task')
    // But tags should be merged
    expect(val?.tags).toContain('local')
    expect(val?.tags).toContain('remote')
  })

  it('should apply DELETE on non-existent record', async () => {
    const delta: SyncDelta = {
      clientId: 'remote',
      vectorClock: 1,
      changes: [
        { table: 'tasks', operation: 'DELETE', id: 'nonexistent', data: {}, timestamp: Date.now() },
      ],
      timestamp: Date.now(),
    }

    const { applied } = await ps.applyDelta(delta)
    expect(applied).toBe(1)
  })

  it('should apply DELETE on existing record', async () => {
    await store.put('tasks:t1', { title: 'Task' })

    const delta: SyncDelta = {
      clientId: 'remote',
      vectorClock: 1,
      changes: [
        { table: 'tasks', operation: 'DELETE', id: 't1', data: {}, timestamp: Date.now() },
      ],
      timestamp: Date.now(),
    }

    const { applied } = await ps.applyDelta(delta)
    expect(applied).toBe(1)
    const val = await store.get('tasks:t1')
    expect(val).toBeNull()
  })

  it('should update vector clock from remote delta', async () => {
    const delta: SyncDelta = {
      clientId: 'remote',
      vectorClock: 99,
      changes: [],
      timestamp: Date.now(),
    }

    await ps.applyDelta(delta)
    expect(ps.getVectorClock()).toBe(99)
  })

  it('should not decrease vector clock from older remote', async () => {
    ps.setVectorClock(50)
    ps.recordOp({ table: 'tasks', operation: 'INSERT', id: 't1', data: {}, timestamp: Date.now() })
    ps.generateDelta() // becomes 51

    const oldDelta: SyncDelta = {
      clientId: 'remote',
      vectorClock: 30, // older
      changes: [],
      timestamp: Date.now(),
    }

    await ps.applyDelta(oldDelta)
    expect(ps.getVectorClock()).toBe(51) // should not go backward
  })

  it('should export and import snapshot', async () => {
    await store.batchPut([
      { key: 'tasks:t1', value: { title: 'Task 1' } },
      { key: 'tasks:t2', value: { title: 'Task 2' } },
      { key: 'tags:tag1', value: { name: 'Work' } },
    ])

    const snapshot = await ps.exportSnapshot()

    // Clear and re-bootstrap
    await store.clear()
    await ps.bootstrapFromSnapshot(snapshot)

    const tasks = await store.list('tasks:')
    expect(tasks.length).toBe(2)
    const tags = await store.list('tags:')
    expect(tags.length).toBe(1)
  })

  it('should get table records', async () => {
    await store.batchPut([
      { key: 'tasks:t1', value: { title: 'T1' } },
      { key: 'tasks:t2', value: { title: 'T2' } },
      { key: 'tags:tag1', value: { name: 'Tag1' } },
    ])

    const taskRecords = await ps.getTableRecords('tasks')
    expect(taskRecords.length).toBe(2)
  })
})