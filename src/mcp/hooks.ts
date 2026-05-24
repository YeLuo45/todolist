/**
 * MCP Hook Manager
 * Provides before/after/around hooks for MCP tool execution
 */

import { messageBus, MessageTypes, type InboundMessage } from '../db/messageBus'

export type HookType = 'before' | 'after' | 'around'

export interface HookContext {
  toolName: string
  args: Record<string, unknown>
  clientName?: string
}

export interface HookResult {
  allowed: boolean
  error?: string
  data?: unknown
}

type HookFn = (context: HookContext) => HookResult | Promise<HookResult>
type AroundHookFn = (context: HookContext, next: () => Promise<HookResult>) => HookResult | Promise<HookResult>

interface HookEntry {
  fn: HookFn
  toolName: string | '*'  // '*' means all tools
}

interface AroundHookEntry {
  fn: AroundHookFn
  toolName: string | '*'  // '*' means all tools
}

// Default hook implementations
const defaultHooks = {
  /**
   * beforeTaskCreate: Reject task creation if title is empty
   */
  beforeTaskCreate: async (context: HookContext): Promise<HookResult> => {
    if (context.toolName === 'create-task') {
      const args = context.args as { title?: string }
      if (!args.title || args.title.trim() === '') {
        return {
          allowed: false,
          error: 'Task title cannot be empty',
        }
      }
    }
    return { allowed: true }
  },

  /**
   * afterTaskComplete: Publish TASK_COMPLETED message to MessageBus
   */
  afterTaskComplete: async (context: HookContext, result: HookResult): Promise<HookResult> => {
    if (context.toolName === 'complete-task' && result.allowed) {
      const args = context.args as { id: string }
      const now = new Date().toISOString()
      const msg: InboundMessage = {
        type: MessageTypes.TASK_COMPLETED,
        payload: { taskId: args.id },
        ts: now,
      }
      messageBus.publish(msg)
    }
    return result
  },

  /**
   * aroundToolCall: Log tool call details
   */
  aroundToolCall: async (
    context: HookContext,
    next: () => Promise<HookResult>
  ): Promise<HookResult> => {
    const startTime = Date.now()
    console.log(`[Hook] Tool call started: ${context.toolName}`, context.args)
    
    try {
      const result = await next()
      const duration = Date.now() - startTime
      console.log(`[Hook] Tool call completed: ${context.toolName} (${duration}ms)`, result)
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[Hook] Tool call failed: ${context.toolName} (${duration}ms)`, error)
      throw error
    }
  },
}

export class HookManager {
  private beforeHooks: HookEntry[] = []
  private afterHooks: HookEntry[] = []
  private aroundHooks: AroundHookEntry[] = []

  /**
   * Register a hook
   * @param hookType - Type of hook: 'before', 'after', or 'around'
   * @param toolName - Tool name or '*' for all tools
   * @param fn - Hook function
   */
  register(hookType: HookType, toolName: string | '*', fn: HookFn | AroundHookFn): void {
    switch (hookType) {
      case 'before':
        this.beforeHooks.push({ fn: fn as HookFn, toolName })
        break
      case 'after':
        this.afterHooks.push({ fn: fn as HookFn, toolName })
        break
      case 'around':
        this.aroundHooks.push({ fn: fn as AroundHookFn, toolName })
        break
    }
  }

  /**
   * Unregister a hook
   */
  unregister(hookType: HookType, toolName: string | '*', fn: HookFn | AroundHookFn): void {
    switch (hookType) {
      case 'before': {
        const idx = this.beforeHooks.findIndex(h => h.fn === fn && (h.toolName === toolName || toolName === '*'))
        if (idx !== -1) this.beforeHooks.splice(idx, 1)
        break
      }
      case 'after': {
        const idx = this.afterHooks.findIndex(h => h.fn === fn && (h.toolName === toolName || toolName === '*'))
        if (idx !== -1) this.afterHooks.splice(idx, 1)
        break
      }
      case 'around': {
        const idx = this.aroundHooks.findIndex(h => h.fn === fn && (h.toolName === toolName || toolName === '*'))
        if (idx !== -1) this.aroundHooks.splice(idx, 1)
        break
      }
    }
  }

  /**
   * Execute before hooks
   */
  async before(toolName: string, args: Record<string, unknown>): Promise<HookResult> {
    // Execute built-in beforeTaskCreate hook
    const builtInResult = await defaultHooks.beforeTaskCreate({ toolName, args })
    if (!builtInResult.allowed) {
      return builtInResult
    }

    // Execute custom before hooks
    for (const hook of this.beforeHooks) {
      if (hook.toolName === '*' || hook.toolName === toolName) {
        const result = await hook.fn({ toolName, args })
        if (!result.allowed) {
          return result
        }
      }
    }
    return { allowed: true }
  }

  /**
   * Execute after hooks
   */
  async after(toolName: string, result: HookResult): Promise<HookResult> {
    // Execute built-in afterTaskComplete hook
    const builtInResult = await defaultHooks.afterTaskComplete({ toolName, args: {} }, result)
    
    // Execute custom after hooks
    for (const hook of this.afterHooks) {
      if (hook.toolName === '*' || hook.toolName === toolName) {
        await hook.fn({ toolName, args: {} })
      }
    }
    return result
  }

  /**
   * Execute around hooks (wraps the actual tool call)
   */
  async around(
    toolName: string,
    args: Record<string, unknown>,
    next: () => Promise<HookResult>
  ): Promise<HookResult> {
    // Filter hooks for this tool
    const relevantHooks = this.aroundHooks.filter(h => h.toolName === '*' || h.toolName === toolName)
    
    // Build the chain: each hook wraps the next
    let currentNext = next
    
    // Start with the built-in aroundToolCall as the innermost wrapper
    let chain: () => Promise<HookResult> = async () => {
      return defaultHooks.aroundToolCall({ toolName, args }, currentNext)
    }
    
    // Wrap with custom hooks (in order they were registered)
    for (const hook of relevantHooks) {
      const nextInChain = chain
      chain = async () => hook.fn({ toolName, args }, nextInChain)
    }
    
    return chain()
  }

  /**
   * Clear all hooks (mainly for testing)
   */
  clear(): void {
    this.beforeHooks = []
    this.afterHooks = []
    this.aroundHooks = []
  }

  /**
   * Get count of registered hooks
   */
  getHookCount(): { before: number; after: number; around: number } {
    return {
      before: this.beforeHooks.length,
      after: this.afterHooks.length,
      around: this.aroundHooks.length,
    }
  }
}

// Singleton instance
let _instance: HookManager | null = null

export function getHookManager(): HookManager {
  if (!_instance) {
    _instance = new HookManager()
  }
  return _instance
}

export function resetHookManager(): void {
  _instance = null
}