/**
 * BudgetController 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BudgetController, BudgetConfig } from '../../mcp/budget'

describe('BudgetController', () => {
  let controller: BudgetController

  beforeEach(() => {
    controller = new BudgetController()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('allocate', () => {
    it('should allocate budget for a new client', () => {
      const config: BudgetConfig = {
        clientName: 'test-client',
        maxCalls: 10,
        windowMs: 60000,
        costPerCall: 1
      }
      controller.allocate(config)
      
      const result = controller.check('test-client')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(10)
    })

    it('should handle unlimited budget (maxCalls = -1)', () => {
      const config: BudgetConfig = {
        clientName: 'unlimited-client',
        maxCalls: -1,
        windowMs: 60000,
        costPerCall: 1
      }
      controller.allocate(config)
      
      const result = controller.check('unlimited-client')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(-1)
    })

    it('should overwrite existing budget', () => {
      controller.allocate({
        clientName: 'client-a',
        maxCalls: 5,
        windowMs: 60000,
        costPerCall: 1
      })
      controller.allocate({
        clientName: 'client-a',
        maxCalls: 10,
        windowMs: 60000,
        costPerCall: 2
      })
      
      const result = controller.check('client-a')
      expect(result.remaining).toBe(10)
    })
  })

  describe('check', () => {
    it('should allow calls when under budget', () => {
      controller.allocate({
        clientName: 'client-check',
        maxCalls: 10,
        windowMs: 60000,
        costPerCall: 1
      })
      
      const result = controller.check('client-check')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(10)
    })

    it('should deny calls when budget exhausted', () => {
      controller.allocate({
        clientName: 'client-deny',
        maxCalls: 2,
        windowMs: 60000,
        costPerCall: 1
      })
      
      controller.record('client-deny')
      controller.record('client-deny')
      
      const result = controller.check('client-deny')
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should return resetAt for denied clients', () => {
      controller.allocate({
        clientName: 'client-reset',
        maxCalls: 1,
        windowMs: 1000,
        costPerCall: 1
      })
      
      controller.record('client-reset')
      const result = controller.check('client-reset')
      
      expect(result.allowed).toBe(false)
      expect(result.resetAt).toBeDefined()
      expect(typeof result.resetAt).toBe('number')
    })

    it('should allow unallocated clients by default', () => {
      const result = controller.check('unknown-client')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(-1)
    })
  })

  describe('record', () => {
    it('should deduct from budget on record', () => {
      controller.allocate({
        clientName: 'client-record',
        maxCalls: 5,
        windowMs: 60000,
        costPerCall: 2
      })
      
      controller.record('client-record')
      const result = controller.check('client-record')
      
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(3)
    })

    it('should handle multiple records', () => {
      controller.allocate({
        clientName: 'client-multi',
        maxCalls: 10,
        windowMs: 60000,
        costPerCall: 1
      })
      
      controller.record('client-multi')
      controller.record('client-multi')
      controller.record('client-multi')
      
      const result = controller.check('client-multi')
      expect(result.remaining).toBe(7)
    })

    it('should handle costPerCall correctly', () => {
      controller.allocate({
        clientName: 'client-cost',
        maxCalls: 100,
        windowMs: 60000,
        costPerCall: 10
      })
      
      controller.record('client-cost')
      const result = controller.check('client-cost')
      
      expect(result.remaining).toBe(90)
    })
  })

  describe('reset', () => {
    it('should clear usage on reset', () => {
      controller.allocate({
        clientName: 'client-reset',
        maxCalls: 5,
        windowMs: 60000,
        costPerCall: 1
      })
      
      controller.record('client-reset')
      controller.record('client-reset')
      controller.reset('client-reset')
      
      const result = controller.check('client-reset')
      expect(result.remaining).toBe(5)
    })

    it('should reschedule reset timer', () => {
      controller.allocate({
        clientName: 'client-timer',
        maxCalls: 5,
        windowMs: 1000,
        costPerCall: 1
      })
      
      controller.record('client-timer')
      controller.reset('client-timer')
      
      // After reset, should have full budget again
      const result = controller.check('client-timer')
      expect(result.remaining).toBe(5)
    })
  })

  describe('window expiry', () => {
    it('should auto-reset after window expires', () => {
      controller.allocate({
        clientName: 'client-expiry',
        maxCalls: 2,
        windowMs: 5000,
        costPerCall: 1
      })
      
      controller.record('client-expiry')
      controller.record('client-expiry')
      
      // Should be denied immediately after exhausting
      expect(controller.check('client-expiry').allowed).toBe(false)
      
      // Fast-forward time past the window
      vi.advanceTimersByTime(5000)
      
      // Should be allowed again after window reset
      expect(controller.check('client-expiry').allowed).toBe(true)
      expect(controller.check('client-expiry').remaining).toBe(2)
    })

    it('should reset usage on window expiry', () => {
      controller.allocate({
        clientName: 'client-window',
        maxCalls: 3,
        windowMs: 3000,
        costPerCall: 1
      })
      
      controller.record('client-window')
      controller.record('client-window')
      
      vi.advanceTimersByTime(3000)
      
      const result = controller.check('client-window')
      expect(result.remaining).toBe(3)
    })
  })

  describe('getUsage', () => {
    it('should return current usage records', () => {
      controller.allocate({
        clientName: 'client-usage',
        maxCalls: 10,
        windowMs: 60000,
        costPerCall: 1
      })
      
      controller.record('client-usage')
      controller.record('client-usage')
      
      const usage = controller.getUsage('client-usage')
      expect(usage.length).toBe(2)
    })

    it('should return empty array for unknown client', () => {
      const usage = controller.getUsage('unknown')
      expect(usage.length).toBe(0)
    })
  })
})