/**
 * Tool Result Cache with TTL and LRU eviction
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export interface CacheEntry {
  key: string
  result: CallToolResult
  expiresAt: number
}

export interface ToolCacheConfig {
  ttlMs: number
  maxEntries: number
}

export const DEFAULT_CACHE_CONFIG: ToolCacheConfig = {
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 100,
}

function hashArgs(args: Record<string, unknown> | undefined): string {
  if (!args || Object.keys(args).length === 0) return 'empty'
  // Stable JSON stringify
  const normalized = JSON.stringify(args, Object.keys(args).sort())
  // Simple djb2 hash
  let hash = 5381
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) ^ normalized.charCodeAt(i)
  }
  return hash.toString(36)
}

export class ToolCache {
  private cache: Map<string, CacheEntry> = new Map()
  private config: ToolCacheConfig

  constructor(config: ToolCacheConfig = DEFAULT_CACHE_CONFIG) {
    this.config = config
  }

  /**
   * Build cache key from tool name and args
   */
  makeKey(toolName: string, args?: Record<string, unknown>): string {
    return `${toolName}:${hashArgs(args)}`
  }

  /**
   * Get cached result if exists and not expired
   */
  get(toolName: string, args?: Record<string, unknown>): CallToolResult | null {
    const key = this.makeKey(toolName, args)
    const entry = this.cache.get(key)

    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Move to end (LRU)
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.result
  }

  /**
   * Set cached result with TTL
   */
  set(toolName: string, args: Record<string, unknown> | undefined, result: CallToolResult): void {
    const key = this.makeKey(toolName, args)

    // Evict oldest if at capacity
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      key,
      result,
      expiresAt: Date.now() + this.config.ttlMs,
    })
  }

  /**
   * Invalidate all entries (call when tool list changes)
   */
  invalidate(): void {
    this.cache.clear()
  }

  /**
   * Invalidate entries for a specific tool
   */
  invalidateTool(toolName: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${toolName}:`)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; maxEntries: number; ttlSeconds: number } {
    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      ttlSeconds: this.config.ttlMs / 1000,
    }
  }
}