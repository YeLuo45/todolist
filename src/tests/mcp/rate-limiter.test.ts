/**
 * RateLimiter 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RateLimiter, RateLimitConfig } from '../../mcp/rate-limiter'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('configure', () => {
    it('should configure rate limit for a client', () => {
      const config: RateLimitConfig = {
        clientName: 'test-client',
        maxPerWindow: 10,
        windowMs: 60000
      }
      limiter.configure(config)
      
      const result = limiter.check('test-client')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(10)
    })

    it('should overwrite existing config', () => {
      limiter.configure({
        clientName: 'client-a',
        maxPerWindow: 5,
        windowMs: 60000
      })
      limiter.configure({
        clientName: 'client-a',
        maxPerWindow: 20,
        windowMs: 60000
      })
      
      const result = limiter.check('client-a')
      expect(result.remaining).toBe(20)
    })
  })

  describe('check - allow/deny', () => {
    it('should allow calls when under limit', () => {
      limiter.configure({
        clientName: 'client-check',
        maxPerWindow: 10,
        windowMs: 60000
      })
      
      const result = limiter.check('client-check')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(10)
    })

    it('should deny calls when limit reached', () => {
      limiter.configure({
        clientName: 'client-deny',
        maxPerWindow: 2,
        windowMs: 60000
      })
      
      limiter.record('client-deny')
      limiter.record('client-deny')
      
      const result = limiter.check('client-deny')
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should allow unconfigured clients', () => {
      const result = limiter.check('unknown-client')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(-1)
    })
  })

  describe('retryAfterMs', () => {
    it('should calculate retryAfterMs correctly', () => {
      limiter.configure({
        clientName: 'client-retry',
        maxPerWindow: 1,
        windowMs: 5000
      })
      
      limiter.record('client-retry')
      const result = limiter.check('client-retry')
      
      expect(result.allowed).toBe(false)
      expect(result.retryAfterMs).toBeDefined()
      expect(result.retryAfterMs).toBeGreaterThan(0)
      expect(result.retryAfterMs).toBeLessThanOrEqual(5000)
    })

    it('should decrease retryAfterMs over time', () => {
      limiter.configure({
        clientName: 'client-time',
        maxPerWindow: 1,
        windowMs: 5000
      })
      
      limiter.record('client-time')
      const result1 = limiter.check('client-time')
      const initialRetryMs = result1.retryAfterMs!
      
      vi.advanceTimersByTime(2000)
      
      const result2 = limiter.check('client-time')
      expect(result2.retryAfterMs).toBeLessThan(initialRetryMs)
    })
  })

  describe('multi-client isolation', () => {
    it('should isolate rate limits between clients', () => {
      limiter.configure({
        clientName: 'client-1',
        maxPerWindow: 2,
        windowMs: 60000
      })
      limiter.configure({
        clientName: 'client-2',
        maxPerWindow: 5,
        windowMs: 60000
      })
      
      limiter.record('client-1')
      limiter.record('client-1')
      
      const result1 = limiter.check('client-1')
      const result2 = limiter.check('client-2')
      
      expect(result1.allowed).toBe(false)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(5)
    })
  })

  describe('window expiry', () => {
    it('should reset after window expires', () => {
      limiter.configure({
        clientName: 'client-expiry',
        maxPerWindow: 2,
        windowMs: 3000
      })
      
      limiter.record('client-expiry')
      limiter.record('client-expiry')
      
      expect(limiter.check('client-expiry').allowed).toBe(false)
      
      vi.advanceTimersByTime(3000)
      
      expect(limiter.check('client-expiry').allowed).toBe(true)
      expect(limiter.check('client-expiry').remaining).toBe(2)
    })

    it('should handle partial window sliding', () => {
      limiter.configure({
        clientName: 'client-slide',
        maxPerWindow: 2,
        windowMs: 5000
      })
      
      limiter.record('client-slide')
      limiter.record('client-slide')
      
      expect(limiter.check('client-slide').allowed).toBe(false)
      
      // After 3000ms (partial window), oldest record should still be valid
      vi.advanceTimersByTime(3000)
      
      const result = limiter.check('client-slide')
      expect(result.allowed).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear rate limit for client', () => {
      limiter.configure({
        clientName: 'client-clear',
        maxPerWindow: 1,
        windowMs: 60000
      })
      
      limiter.record('client-clear')
      limiter.clear('client-clear')
      
      const result = limiter.check('client-clear')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(-1)
    })

    it('should handle clearing unknown client', () => {
      expect(() => limiter.clear('unknown')).not.toThrow()
    })
  })
})