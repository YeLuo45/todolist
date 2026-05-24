import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withRetry, getBackoffDelay, DEFAULT_RETRY_CONFIG, type RetryConfig } from "../../mcp/retry"

describe('retry utility', () => {
  describe('getBackoffDelay', () => {
    it('should return base delay for attempt 1', () => {
      const config: RetryConfig = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 4000 }
      expect(getBackoffDelay(1, config)).toBe(1000)
    })

    it('should double delay for each attempt', () => {
      const config: RetryConfig = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 4000 }
      expect(getBackoffDelay(2, config)).toBe(2000)
      expect(getBackoffDelay(3, config)).toBe(4000)
    })

    it('should cap at maxDelayMs', () => {
      const config: RetryConfig = { maxAttempts: 10, baseDelayMs: 1000, maxDelayMs: 4000 }
      expect(getBackoffDelay(5, config)).toBe(4000) // 1000 * 2^4 = 16000, capped to 4000
    })
  })

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await withRetry(fn)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockResolvedValueOnce('success')
      const result = await withRetry(fn)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should retry maxAttempts times then throw', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'))
      await expect(withRetry(fn)).rejects.toThrow('always fails')
      expect(fn).toHaveBeenCalledTimes(3) // DEFAULT_RETRY_CONFIG.maxAttempts = 3
    })

    it('should call onRetry callback before each retry', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))
      const onRetry = vi.fn()
      await expect(withRetry(fn, DEFAULT_RETRY_CONFIG, onRetry)).rejects.toThrow()
      expect(onRetry).toHaveBeenCalledTimes(2) // called before attempt 2 and 3
    })

    it('should use custom config', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))
      const config: RetryConfig = { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 1000 }
      await expect(withRetry(fn, config)).rejects.toThrow()
      expect(fn).toHaveBeenCalledTimes(5)
    })
  })
})