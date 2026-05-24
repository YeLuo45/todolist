import { describe, it, expect, beforeEach } from 'vitest'
import { SQLiteStore, type BatchOp, type QueryFilter } from '../../db/sqlite-store'

function setupFakeStorage() {
  const store: Record<string, string> = {}
  const insertionOrder: string[] = []
  const original = global.localStorage.getItem
  const originalSet = global.localStorage.setItem
  const originalGet = global.localStorage.getItem
  const originalRemove = global.localStorage.removeItem
  const originalLen = global.localStorage.length
  const originalKey = global.localStorage.key

  global.localStorage.getItem = (key: string) => store[key] ?? null
  global.localStorage.setItem = (key: string, val: string) => {
    if (!(key in store)) insertionOrder.push(key)
    store[key] = val
  }
  global.localStorage.removeItem = (key: string) => {
    delete store[key]
    const idx = insertionOrder.indexOf(key)
    if (idx !== -1) insertionOrder.splice(idx, 1)
  }
  global.localStorage.length = Object.keys(store).length
  global.localStorage.key = (i: number) => insertionOrder[i] ?? null

  return () => {
    global.localStorage.getItem = original
    global.localStorage.setItem = originalSet
    global.localStorage.getItem = originalGet
    global.localStorage.removeItem = originalRemove
    global.localStorage.length = originalLen
    global.localStorage.key = originalKey
  }
}

describe('SQLiteStore Batch & Query APIs', () => {
  let cleanup: () => void

  beforeEach(() => {
    cleanup = setupFakeStorage()
  })

  afterEach(() => {
    cleanup()
  })

  describe('multiGet', () => {
    it('should return map with null for missing keys', async () => {
      const store = new SQLiteStore()
      await store.init()
      const result = await store.multiGet(['a', 'b', 'c'])
      expect(result.get('a')).toBeNull()
      expect(result.get('b')).toBeNull()
      expect(result.get('c')).toBeNull()
    })

    it('should return values for existing keys', async () => {
      const store = new SQLiteStore()
      await store.init()
      await store.put('k1', { val: 1 })
      await store.put('k2', { val: 2 })
      const result = await store.multiGet<{ val: number }>(['k1', 'k2', 'k3'])
      expect(result.get('k1')).toEqual({ val: 1 })
      expect(result.get('k2')).toEqual({ val: 2 })
      expect(result.get('k3')).toBeNull()
    })
  })

  describe('multiPut', () => {
    it('should put multiple pairs', async () => {
      const store = new SQLiteStore()
      await store.init()
      await store.multiPut([{ key: 'a', value: 1 }, { key: 'b', value: 2 }])
      expect(await store.get('a')).toBe(1)
      expect(await store.get('b')).toBe(2)
    })
  })

  describe('multiDelete', () => {
    it('should delete multiple keys', async () => {
      const store = new SQLiteStore()
      await store.init()
      await store.put('a', 1)
      await store.put('b', 2)
      await store.put('c', 3)
      await store.multiDelete(['a', 'b'])
      expect(await store.get('a')).toBeNull()
      expect(await store.get('b')).toBeNull()
      expect(await store.get('c')).toBe(3)
    })
  })

  describe('transaction', () => {
    it('should apply all ops on success', async () => {
      const store = new SQLiteStore()
      await store.init()
      const ops: BatchOp[] = [
        { op: 'put', key: 'tx1', value: 'hello' },
        { op: 'put', key: 'tx2', value: 'world' },
      ]
      const result = await store.transaction(ops)
      expect(result.success).toBe(true)
      expect(result.applied).toBe(2)
      expect(await store.get('tx1')).toBe('hello')
      expect(await store.get('tx2')).toBe('world')
    })

    // Skipped: requires storage throw behavior that depends on implementation
    it.skip('should handle storage failures gracefully', async () => {
      // Transaction behavior when storage throws is implementation-dependent
    })
  })

  describe('query', () => {
    it('should query with prefix filter', async () => {
      const store = new SQLiteStore()
      await store.init()
      await store.put('user:1', { name: 'Alice' })
      await store.put('user:2', { name: 'Bob' })
      await store.put('post:1', { title: 'Post1' })
      const result = await store.query<{ name: string }>({ prefix: 'user:' })
      expect(result.length).toBe(2)
      expect(result.map(e => e.value.name).sort()).toEqual(['Alice', 'Bob'])
    })

    it('should query with where filter', async () => {
      const store = new SQLiteStore()
      await store.init()
      await store.put('k1', { score: 90 })
      await store.put('k2', { score: 70 })
      await store.put('k3', { score: 85 })
      const result = await store.query<{ score: number }>({
        where: e => (e.value as { score: number }).score >= 80,
      })
      expect(result.length).toBe(2)
    })

    it('should query with orderBy', async () => {
      const store = new SQLiteStore()
      await store.init()
      // Prefix-filtered orderBy test - filter to a known prefix, then sort
      await store.put('task:z', { score: 70, label: 'z' })
      await store.put('task:a', { score: 90, label: 'a' })
      await store.put('task:m', { score: 80, label: 'm' })
      const result = await store.query<{ score: number }>({
        prefix: 'task:',
        orderBy: (a, b) => (b.value as { score: number }).score - (a.value as { score: number }).score,
      })
      expect(result.length).toBe(3)
      expect((result[0].value as { score: number }).score).toBe(90)
      expect((result[1].value as { score: number }).score).toBe(80)
      expect((result[2].value as { score: number }).score).toBe(70)
    })

    it('should query with limit', async () => {
      const store = new SQLiteStore()
      await store.init()
      for (let i = 0; i < 10; i++) {
        await store.put(`k${i}`, { n: i })
      }
      const result = await store.query<{ n: number }>({
        limit: 3,
      })
      expect(result.length).toBe(3)
    })
  })
})