import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HookManager, getHookManager, resetHookManager, type HookContext, type HookResult } from '../../mcp/hooks'
import { messageBus, MessageTypes } from '../../db/messageBus'

describe('HookManager', () => {
  beforeEach(() => {
    resetHookManager()
    messageBus.reset()
  })

  describe('register and unregister', () => {
    it('should register a before hook', () => {
      const manager = getHookManager()
      const hook = vi.fn(async () => ({ allowed: true }))
      
      manager.register('before', 'create-task', hook)
      
      const count = manager.getHookCount()
      expect(count.before).toBe(1)
    })

    it('should register an after hook', () => {
      const manager = getHookManager()
      const hook = vi.fn(async () => ({ allowed: true }))
      
      manager.register('after', 'create-task', hook)
      
      const count = manager.getHookCount()
      expect(count.after).toBe(1)
    })

    it('should register an around hook', () => {
      const manager = getHookManager()
      const hook = vi.fn(async () => ({ allowed: true }))
      
      manager.register('around', 'create-task', hook)
      
      const count = manager.getHookCount()
      expect(count.around).toBe(1)
    })

    it('should register hook for all tools using "*"', () => {
      const manager = getHookManager()
      const hook = vi.fn(async () => ({ allowed: true }))
      
      manager.register('before', '*', hook)
      
      const count = manager.getHookCount()
      expect(count.before).toBe(1)
    })

    it('should unregister a hook', () => {
      const manager = getHookManager()
      const hook = vi.fn(async () => ({ allowed: true }))
      
      manager.register('before', 'create-task', hook)
      expect(manager.getHookCount().before).toBe(1)
      
      manager.unregister('before', 'create-task', hook)
      expect(manager.getHookCount().before).toBe(0)
    })

    it('should unregister hook with "*" tool name', () => {
      const manager = getHookManager()
      const hook = vi.fn(async () => ({ allowed: true }))
      
      manager.register('before', '*', hook)
      expect(manager.getHookCount().before).toBe(1)
      
      manager.unregister('before', '*', hook)
      expect(manager.getHookCount().before).toBe(0)
    })
  })

  describe('before hook execution', () => {
    it('should execute before hook for matching tool', async () => {
      const manager = getHookManager()
      const hook = vi.fn(async (ctx: HookContext) => ({ allowed: true }))
      
      manager.register('before', 'create-task', hook)
      
      const result = await manager.before('create-task', { title: 'Test' })
      
      expect(hook).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'create-task',
        args: { title: 'Test' },
      }))
      expect(result.allowed).toBe(true)
    })

    it('should execute before hook for "*" (all tools)', async () => {
      const manager = getHookManager()
      const hook = vi.fn(async () => ({ allowed: true }))
      
      manager.register('before', '*', hook)
      
      await manager.before('any-tool', {})
      await manager.before('another-tool', {})
      
      expect(hook).toHaveBeenCalledTimes(2)
    })

    it('should block execution when hook returns allowed: false', async () => {
      const manager = getHookManager()
      const blockingHook = vi.fn(async () => ({
        allowed: false,
        error: 'Blocked by hook',
      }))
      
      manager.register('before', 'create-task', blockingHook)
      
      const result = await manager.before('create-task', { title: 'Test' })
      
      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Blocked by hook')
    })
  })

  describe('after hook execution', () => {
    it('should execute after hook for matching tool', async () => {
      const manager = getHookManager()
      const hook = vi.fn(async () => ({ allowed: true }))
      
      manager.register('after', 'complete-task', hook)
      
      const result: HookResult = { allowed: true }
      await manager.after('complete-task', result)
      
      expect(hook).toHaveBeenCalled()
    })

    it('should execute after hook for "*" (all tools)', async () => {
      const manager = getHookManager()
      const hook = vi.fn(async () => ({ allowed: true }))
      
      manager.register('after', '*', hook)
      
      await manager.after('any-tool', { allowed: true })
      await manager.after('another-tool', { allowed: true })
      
      expect(hook).toHaveBeenCalledTimes(2)
    })
  })

  describe('around hook execution', () => {
    it('should wrap the next function with around hook', async () => {
      const manager = getHookManager()
      const nextFn = vi.fn(async () => ({ allowed: true }))
      const aroundHook = vi.fn(async (ctx: HookContext, next: () => Promise<HookResult>) => {
        return await next()
      })
      
      manager.register('around', 'create-task', aroundHook)
      
      const result = await manager.around('create-task', { title: 'Test' }, nextFn)
      
      expect(nextFn).toHaveBeenCalled()
      expect(result.allowed).toBe(true)
    })

    it('should execute around hook for "*" (all tools)', async () => {
      const manager = getHookManager()
      const nextFn = vi.fn(async () => ({ allowed: true }))
      const aroundHook = vi.fn(async (ctx: HookContext, next: () => Promise<HookResult>) => {
        return await next()
      })
      
      manager.register('around', '*', aroundHook)
      
      await manager.around('any-tool', {}, nextFn)
      
      expect(aroundHook).toHaveBeenCalled()
    })
  })

  describe('built-in beforeTaskCreate hook', () => {
    it('should block task creation when title is empty', async () => {
      const manager = getHookManager()
      
      const result = await manager.before('create-task', { title: '' })
      
      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Task title cannot be empty')
    })

    it('should block task creation when title is only whitespace', async () => {
      const manager = getHookManager()
      
      const result = await manager.before('create-task', { title: '   ' })
      
      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Task title cannot be empty')
    })

    it('should allow task creation when title is valid', async () => {
      const manager = getHookManager()
      
      const result = await manager.before('create-task', { title: 'Valid Title' })
      
      expect(result.allowed).toBe(true)
    })

    it('should not apply to other tools', async () => {
      const manager = getHookManager()
      
      const result = await manager.before('update-task', {})
      
      expect(result.allowed).toBe(true)
    })
  })

  describe('built-in afterTaskComplete hook', () => {
    it('should publish TASK_COMPLETED message when task is completed', async () => {
      const manager = getHookManager()
      
      let receivedMessage: { type: string; payload: Record<string, unknown> } | null = null
      messageBus.subscribe(msg => {
        receivedMessage = msg as typeof receivedMessage
      })
      
      const result: HookResult = { allowed: true, data: { id: 'task-123' } }
      await manager.after('complete-task', result)
      await messageBus.flush()
      
      expect(receivedMessage).not.toBeNull()
      expect(receivedMessage!.type).toBe(MessageTypes.TASK_COMPLETED)
      expect(receivedMessage!.payload).toHaveProperty('taskId')
    })

    it('should not publish when hook result is not allowed', async () => {
      const manager = getHookManager()
      
      let messageCount = 0
      messageBus.subscribe(() => { messageCount++ })
      
      const result: HookResult = { allowed: false }
      await manager.after('complete-task', result)
      await messageBus.flush()
      
      expect(messageCount).toBe(0)
    })
  })

  describe('built-in aroundToolCall hook', () => {
    it('should log tool call start and completion', async () => {
      const manager = getHookManager()
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const nextFn = vi.fn(async () => ({ allowed: true }))
      await manager.around('create-task', { title: 'Test' }, nextFn)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Hook] Tool call started: create-task',
        { title: 'Test' }
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Hook] Tool call completed: create-task (0ms)',
        expect.objectContaining({ allowed: true })
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('clear', () => {
    it('should remove all registered hooks', () => {
      const manager = getHookManager()
      
      manager.register('before', 'tool-1', async () => ({ allowed: true }))
      manager.register('after', 'tool-2', async () => ({ allowed: true }))
      manager.register('around', 'tool-3', async () => ({ allowed: true }))
      
      expect(manager.getHookCount().before).toBe(1)
      expect(manager.getHookCount().after).toBe(1)
      expect(manager.getHookCount().around).toBe(1)
      
      manager.clear()
      
      expect(manager.getHookCount().before).toBe(0)
      expect(manager.getHookCount().after).toBe(0)
      expect(manager.getHookCount().around).toBe(0)
    })
  })

  describe('singleton behavior', () => {
    it('should return the same instance from getHookManager', () => {
      const manager1 = getHookManager()
      const manager2 = getHookManager()
      
      expect(manager1).toBe(manager2)
    })

    it('should reset between tests', () => {
      resetHookManager()
      
      const manager1 = getHookManager()
      manager1.register('before', '*', async () => ({ allowed: true }))
      
      resetHookManager()
      
      const manager2 = getHookManager()
      expect(manager2.getHookCount().before).toBe(0)
    })
  })

  describe('multiple hooks', () => {
    it('should execute multiple before hooks in order', async () => {
      const manager = getHookManager()
      const callOrder: string[] = []
      
      manager.register('before', '*', async () => {
        callOrder.push('hook-1')
        return { allowed: true }
      })
      manager.register('before', '*', async () => {
        callOrder.push('hook-2')
        return { allowed: true }
      })
      
      await manager.before('any-tool', {})
      
      expect(callOrder).toEqual(['hook-1', 'hook-2'])
    })

    it('should stop execution if a before hook blocks', async () => {
      const manager = getHookManager()
      const callOrder: string[] = []
      
      manager.register('before', '*', async () => {
        callOrder.push('hook-1')
        return { allowed: true }
      })
      manager.register('before', '*', async () => {
        callOrder.push('hook-2')
        return { allowed: false, error: 'Blocked' }
      })
      manager.register('before', '*', async () => {
        callOrder.push('hook-3')
        return { allowed: true }
      })
      
      await manager.before('any-tool', {})
      
      expect(callOrder).toEqual(['hook-1', 'hook-2'])
    })
  })
})