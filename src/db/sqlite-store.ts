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