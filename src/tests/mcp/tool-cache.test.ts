import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ToolCache, DEFAULT_CACHE_CONFIG, type ToolCacheConfig } from "../../mcp/tool-cache"
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

function makeResult(text: string): CallToolResult {
  return { content: [{ type: 'text' as const, text }] }
}

describe('ToolCache', () => {
  describe('makeKey', () => {
    it('should create stable hash for same args', () => {
      const cache = new ToolCache()
      const key1 = cache.makeKey('list-tasks', { status: 'pending' })
      const key2 = cache.makeKey('list-tasks', { status: 'pending' })
      expect(key1).toBe(key2)
    })

    it('should create different keys for different args', () => {
      const cache = new ToolCache()
      const key1 = cache.makeKey('list-tasks', { status: 'pending' })
      const key2 = cache.makeKey('list-tasks', { status: 'completed' })
      expect(key1).not.toBe(key2)
    })

    it('should handle empty args', () => {
      const cache = new ToolCache()
      const key = cache.makeKey('list-tasks')
      expect(key).toBe('list-tasks:empty')
    })
  })

  describe('get/set', () => {
    it('should return null for cache miss', () => {
      const cache = new ToolCache()
      expect(cache.get('nonexistent')).toBeNull()
    })

    it('should return cached result', () => {
      const cache = new ToolCache({ ttlMs: 60000, maxEntries: 10 })
      const result = makeResult('cached')
      cache.set('list-tasks', undefined, result)
      expect(cache.get('list-tasks', undefined)).toEqual(result)
    })

    it('should evict expired entries', async () => {
      const cache = new ToolCache({ ttlMs: 50, maxEntries: 10 })
      const result = makeResult('expired')
      cache.set('list-tasks', undefined, result)
      // Wait for expiration
      await new Promise(r => setTimeout(r, 60))
      expect(cache.get('list-tasks', undefined)).toBeNull()
    })

    it('should LRU evict when at capacity', () => {
      const cache = new ToolCache({ ttlMs: 60000, maxEntries: 3 })
      cache.set('tool1', undefined, makeResult('t1'))
      cache.set('tool2', undefined, makeResult('t2'))
      cache.set('tool3', undefined, makeResult('t3'))
      // 4th entry should evict oldest (tool1)
      cache.set('tool4', undefined, makeResult('t4'))
      expect(cache.get('tool1', undefined)).toBeNull()
      expect(cache.get('tool2', undefined)).not.toBeNull()
      expect(cache.get('tool4', undefined)).not.toBeNull()
    })
  })

  describe('invalidate', () => {
    it('should clear all entries', () => {
      const cache = new ToolCache()
      cache.set('tool1', undefined, makeResult('t1'))
      cache.set('tool2', undefined, makeResult('t2'))
      cache.invalidate()
      expect(cache.getStats().size).toBe(0)
    })
  })

  describe('invalidateTool', () => {
    it('should remove entries for specific tool', () => {
      const cache = new ToolCache()
      cache.set('tool1', undefined, makeResult('t1'))
      cache.set('tool1', { foo: 'bar' }, makeResult('t1b'))
      cache.set('tool2', undefined, makeResult('t2'))
      cache.invalidateTool('tool1')
      expect(cache.get('tool1', undefined)).toBeNull()
      expect(cache.get('tool1', { foo: 'bar' })).toBeNull()
      expect(cache.get('tool2', undefined)).not.toBeNull()
    })
  })

  describe('getStats', () => {
    it('should return correct stats', () => {
      const cache = new ToolCache({ ttlMs: 300000, maxEntries: 50 })
      cache.set('tool1', undefined, makeResult('t1'))
      const stats = cache.getStats()
      expect(stats.size).toBe(1)
      expect(stats.maxEntries).toBe(50)
      expect(stats.ttlSeconds).toBe(300)
    })
  })
})