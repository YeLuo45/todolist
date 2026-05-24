/**
 * SQLiteStore Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SQLiteStore } from '../../db/sqlite-store'

// Helper to clear all sqlite-kv:* keys
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

describe('SQLiteStore', () => {
  let store: SQLiteStore

  beforeEach(async () => {
    store = new SQLiteStore()
    clearTestKeys()
    await store.init()
  })

  afterEach(() => {
    clearTestKeys()
  })

  it('should initialize', async () => {
    expect(store.isInitialized()).toBe(true)
    await expect(store.init()).resolves.toBeUndefined()
  })

  it('should put and get a string value', async () => {
    await store.put('name', 'Alice')
    const result = await store.get<string>('name')
    expect(result).toBe('Alice')
  })

  it('should put and get an object value', async () => {
    const obj = { id: '1', title: 'Test', priority: 'high' }
    await store.put('task:1', obj)
    const result = await store.get<typeof obj>('task:1')
    expect(result).toEqual(obj)
  })

  it('should return null for missing key', async () => {
    const result = await store.get('nonexistent')
    expect(result).toBeNull()
  })

  it('should delete a key', async () => {
    await store.put('name', 'Bob')
    await store.delete('name')
    const result = await store.get('name')
    expect(result).toBeNull()
  })

  it('should list keys with prefix', async () => {
    await store.put('task:1', { title: 'Task 1' })
    await store.put('task:2', { title: 'Task 2' })
    await store.put('tag:1', { name: 'Tag 1' })

    const taskResults = await store.list('task:')
    expect(taskResults.length).toBe(2)
    expect(taskResults.map(r => r.key).sort()).toEqual(['task:1', 'task:2'])

    const tagResults = await store.list('tag:')
    expect(tagResults.length).toBe(1)
    expect(tagResults[0].key).toBe('tag:1')
  })

  it('should getAll entries', async () => {
    await store.put('a:1', { n: 1 })
    await store.put('a:2', { n: 2 })
    await store.put('b:1', { n: 3 })

    const results = await store.getAll()
    expect(results.length).toBe(3)
  })

  it('should batch put multiple pairs', async () => {
    await store.batchPut([
      { key: 'p:1', value: { title: 'P1' } },
      { key: 'p:2', value: { title: 'P2' } },
      { key: 'p:3', value: { title: 'P3' } },
    ])

    const results = await store.list('p:')
    expect(results.length).toBe(3)
    expect(await store.get('p:1')).toEqual({ title: 'P1' })
    expect(await store.get('p:2')).toEqual({ title: 'P2' })
  })

  it('should batch delete multiple keys', async () => {
    await store.batchPut([
      { key: 'x:1', value: 1 },
      { key: 'x:2', value: 2 },
      { key: 'x:3', value: 3 },
    ])
    await store.batchDelete(['x:1', 'x:3'])

    const results = await store.list('x:')
    expect(results.length).toBe(1)
    expect(results[0].key).toBe('x:2')
  })

  it('should clear by prefix', async () => {
    await store.batchPut([
      { key: 'clear:1', value: 1 },
      { key: 'clear:2', value: 2 },
      { key: 'keep:1', value: 99 },
    ])
    await store.clearPrefix('clear:')

    expect(await store.get('clear:1')).toBeNull()
    expect(await store.get('clear:2')).toBeNull()
    expect(await store.get('keep:1')).toBe(99)
  })

  it('should clear all entries', async () => {
    await store.batchPut([
      { key: 't:1', value: 1 },
      { key: 't:2', value: 2 },
    ])
    await store.clear()

    const results = await store.getAll()
    expect(results.length).toBe(0)
  })

  it('should handle nested objects', async () => {
    const nested = {
      user: {
        name: 'Alice',
        addresses: [{ city: 'NYC' }, { city: 'LA' }],
      },
      tags: ['work', 'urgent'],
    }
    await store.put('user:1', nested)
    const result = await store.get<typeof nested>('user:1')
    expect(result).toEqual(nested)
  })

  it('should overwrite existing value', async () => {
    await store.put('counter', { count: 1 })
    await store.put('counter', { count: 2 })
    const result = await store.get<{ count: number }>('counter')
    expect(result?.count).toBe(2)
  })
})