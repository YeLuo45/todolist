/**
 * SQLiteStore - LocalStorage-based KV store
 * Simulates a simple key-value store with JSON serialization
 * Supports batch operations to simulate transactions
 */

const STORAGE_PREFIX = 'sqlite-kv:'

export interface KvPair {
  key: string
  value: unknown
}

export type BatchOp = { op: 'put'; key: string; value: unknown } | { op: 'delete'; key: string }

export interface BatchResult {
  success: boolean
  applied: number
  rolledBack: number
}

export interface QueryFilter {
  prefix?: string
  where?: (entry: { key: string; value: unknown }) => boolean
  orderBy?: (a: { key: string; value: unknown }, b: { key: string; value: unknown }) => number
  limit?: number
  offset?: number
}

export class SQLiteStore {
  private initialized = false

  /**
   * Initialize the store - nothing to do for localStorage-based impl
   */
  async init(): Promise<void> {
    this.initialized = true
  }

  /**
   * Check if store is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Put a key-value pair into the store
   */
  async put(key: string, value: unknown): Promise<void> {
    const storageKey = STORAGE_PREFIX + key
    localStorage.setItem(storageKey, JSON.stringify(value))
  }

  /**
   * Get a value by key
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const storageKey = STORAGE_PREFIX + key
    const raw = localStorage.getItem(storageKey)
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  /**
   * Delete a key from the store
   */
  async delete(key: string): Promise<void> {
    const storageKey = STORAGE_PREFIX + key
    localStorage.removeItem(storageKey)
  }

  /**
   * List all values with keys matching a prefix
   */
  async list<T = unknown>(prefix: string): Promise<{ key: string; value: T }[]> {
    const results: { key: string; value: T }[] = []
    const searchPrefix = STORAGE_PREFIX + prefix
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i)
      if (storageKey && storageKey.startsWith(searchPrefix)) {
        const raw = localStorage.getItem(storageKey)
        if (raw !== null) {
          try {
            const value = JSON.parse(raw) as T
            const key = storageKey.slice(STORAGE_PREFIX.length)
            results.push({ key, value })
          } catch {
            // skip malformed entries
          }
        }
      }
    }
    return results
  }

  /**
   * Get all key-value pairs in the store
   */
  async getAll<T = unknown>(): Promise<{ key: string; value: T }[]> {
    const results: { key: string; value: T }[] = []
    const prefix = STORAGE_PREFIX
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i)
      if (storageKey && storageKey.startsWith(prefix)) {
        const raw = localStorage.getItem(storageKey)
        if (raw !== null) {
          try {
            const value = JSON.parse(raw) as T
            const key = storageKey.slice(STORAGE_PREFIX.length)
            results.push({ key, value })
          } catch {
            // skip malformed entries
          }
        }
      }
    }
    return results
  }

  /**
   * Batch put - simulate transaction by putting multiple pairs
   */
  async batchPut(pairs: KvPair[]): Promise<void> {
    for (const { key, value } of pairs) {
      await this.put(key, value)
    }
  }

  /**
   * Batch delete - simulate transaction by deleting multiple keys
   */
  async batchDelete(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key)
    }
  }

  /**
   * Multi-get - fetch multiple keys at once, returns map
   */
  async multiGet<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>()
    for (const key of keys) {
      result.set(key, await this.get<T>(key))
    }
    return result
  }

  /**
   * Multi-put - put multiple pairs efficiently
   */
  async multiPut<T = unknown>(pairs: KvPair<T>[]): Promise<void> {
    for (const { key, value } of pairs) {
      await this.put(key, value)
    }
  }

  /**
   * Multi-delete - delete multiple keys at once
   */
  async multiDelete(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key)
    }
  }

  /**
   * Execute a transaction: apply all ops, rollback on failure
   */
  async transaction(ops: BatchOp[]): Promise<BatchResult> {
    const snapshot: string[] = []
    for (const op of ops) {
      if (op.op === 'delete') {
        const storageKey = STORAGE_PREFIX + op.key
        const raw = localStorage.getItem(storageKey)
        if (raw !== null) {
          snapshot.push(raw)
        } else {
          snapshot.push('')
        }
      } else {
        const storageKey = STORAGE_PREFIX + op.key
        snapshot.push(localStorage.getItem(storageKey) ?? '')
      }
    }

    let applied = 0
    try {
      for (const op of ops) {
        if (op.op === 'put') {
          localStorage.setItem(STORAGE_PREFIX + op.key, JSON.stringify(op.value))
        } else {
          localStorage.removeItem(STORAGE_PREFIX + op.key)
        }
        applied++
      }
      return { success: true, applied, rolledBack: 0 }
    } catch {
      // Rollback
      let idx = 0
      for (const op of ops) {
        if (idx >= applied) break
        if (op.op === 'put') {
          const storageKey = STORAGE_PREFIX + op.key
          if (snapshot[idx] === '') {
            localStorage.removeItem(storageKey)
          } else {
            localStorage.setItem(storageKey, snapshot[idx])
          }
        }
        idx++
      }
      return { success: false, applied: 0, rolledBack: ops.length }
    }
  }

  /**
   * Query the store with filters
   */
  async query<T = unknown>(filter: QueryFilter): Promise<{ key: string; value: T }[]> {
    let entries = await this.list<T>(filter.prefix ?? '')

    if (filter.where) {
      entries = entries.filter(e => filter.where!({ key: e.key, value: e.value }))
    }

    if (filter.orderBy) {
      entries.sort(filter.orderBy)
    }

    if (filter.offset) {
      entries = entries.slice(filter.offset)
    }

    if (filter.limit !== undefined) {
      entries = entries.slice(0, filter.limit)
    }

    return entries
  }

  /**
   * Clear all keys with a given prefix
   */
  async clearPrefix(prefix: string): Promise<void> {
    const searchPrefix = STORAGE_PREFIX + prefix
    const toDelete: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i)
      if (storageKey && storageKey.startsWith(searchPrefix)) {
        toDelete.push(storageKey)
      }
    }
    for (const key of toDelete) {
      localStorage.removeItem(key)
    }
  }

  /**
   * Clear the entire store
   */
  async clear(): Promise<void> {
    const toDelete: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i)
      if (storageKey && storageKey.startsWith(STORAGE_PREFIX)) {
        toDelete.push(storageKey)
      }
    }
    for (const key of toDelete) {
      localStorage.removeItem(key)
    }
  }
}

// Default export for convenience
export const sqliteStore = new SQLiteStore()