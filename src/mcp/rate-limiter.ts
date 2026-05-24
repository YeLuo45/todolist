/**
 * RateLimiter - 速率限制器
 * 
 * 使用滑动窗口算法实现客户端速率限制。
 */

export interface RateLimitConfig {
  clientName: string
  maxPerWindow: number
  windowMs: number
}

export interface RateLimitCheckResult {
  allowed: boolean
  retryAfterMs?: number
  remaining: number
}

interface SlidingWindowEntry {
  timestamp: number
}

export class RateLimiter {
  private windows: Map<string, {
    config: RateLimitConfig
    entries: SlidingWindowEntry[]
    timer?: ReturnType<typeof setTimeout>
  }> = new Map()

  /**
   * 配置客户端的速率限制
   */
  configure(config: RateLimitConfig): void {
    // 如果已存在，先清除
    const existing = this.windows.get(config.clientName)
    if (existing?.timer) {
      clearTimeout(existing.timer)
    }

    this.windows.set(config.clientName, {
      config: { ...config },
      entries: [],
      timer: undefined
    })
  }

  /**
   * 检查客户端是否允许调用
   */
  check(clientName: string): RateLimitCheckResult {
    const window = this.windows.get(clientName)
    if (!window) {
      // 未配置的客户端默认允许
      return { allowed: true, remaining: -1 }
    }

    const now = Date.now()
    const windowStart = now - window.config.windowMs

    // 清理过期记录
    window.entries = window.entries.filter(e => e.timestamp >= windowStart)

    const remaining = window.config.maxPerWindow - window.entries.length

    if (remaining <= 0) {
      // 计算需要等待多久
      const oldestEntry = window.entries[0]
      const retryAfterMs = oldestEntry 
        ? (oldestEntry.timestamp + window.config.windowMs) - now 
        : window.config.windowMs
      return { allowed: false, retryAfterMs, remaining: 0 }
    }

    return { allowed: true, remaining }
  }

  /**
   * 记录一次调用（添加到滑动窗口）
   */
  record(clientName: string): void {
    const window = this.windows.get(clientName)
    if (!window) return

    const now = Date.now()
    const windowStart = now - window.config.windowMs

    // 清理过期记录
    window.entries = window.entries.filter(e => e.timestamp >= windowStart)

    // 添加新记录
    window.entries.push({ timestamp: now })

    // 如果还没有定时器，设置窗口清理定时器
    if (!window.timer) {
      window.timer = setTimeout(() => {
        const w = this.windows.get(clientName)
        if (w) {
          w.entries = []
          w.timer = undefined
        }
      }, window.config.windowMs)
    }
  }

  /**
   * 清除客户端的速率限制
   */
  clear(clientName: string): void {
    const window = this.windows.get(clientName)
    if (window?.timer) {
      clearTimeout(window.timer)
    }
    this.windows.delete(clientName)
  }
}