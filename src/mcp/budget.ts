/**
 * BudgetController - MCP调用配额管理
 * 
 * 管理客户端的调用配额，支持时间窗口自动重置。
 */

export interface CallRecord {
  timestamp: number
  cost: number
}

export interface BudgetConfig {
  clientName: string
  maxCalls: number        // -1 = unlimited
  windowMs: number        // 时间窗口毫秒
  costPerCall: number     // 单次调用成本
}

export interface BudgetCheckResult {
  allowed: boolean
  remaining: number
  resetAt?: number
}

export class BudgetController {
  private budgets: Map<string, BudgetConfig> = new Map()
  private usage: Map<string, CallRecord[]> = new Map()
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  /**
   * 分配预算给客户端
   */
  allocate(config: BudgetConfig): void {
    this.budgets.set(config.clientName, { ...config })
    this.usage.set(config.clientName, [])
    this.scheduleReset(config.clientName, config.windowMs)
  }

  /**
   * 检查客户端是否允许调用
   */
  check(clientName: string): BudgetCheckResult {
    const budget = this.budgets.get(clientName)
    if (!budget) {
      // 未分配的客户端默认允许
      return { allowed: true, remaining: -1 }
    }

    const now = Date.now()
    const records = this.getActiveRecords(clientName, now)
    const totalUsed = records.reduce((sum, r) => sum + r.cost, 0)
    const remaining = budget.maxCalls - totalUsed

    if (budget.maxCalls === -1) {
      return { allowed: true, remaining: -1 }
    }

    if (remaining <= 0) {
      const oldestRecord = records[0]
      const resetAt = oldestRecord ? oldestRecord.timestamp + budget.windowMs : now + budget.windowMs
      return { allowed: false, remaining: 0, resetAt }
    }

    return { allowed: true, remaining }
  }

  /**
   * 记录一次调用，扣除配额
   */
  record(clientName: string): void {
    const budget = this.budgets.get(clientName)
    if (!budget) return

    const records = this.usage.get(clientName) || []
    records.push({
      timestamp: Date.now(),
      cost: budget.costPerCall
    })
    this.usage.set(clientName, records)
  }

  /**
   * 重置客户端的预算使用
   */
  reset(clientName: string): void {
    // 取消已有的定时器
    const existingTimer = this.timers.get(clientName)
    if (existingTimer) {
      clearTimeout(existingTimer)
      this.timers.delete(clientName)
    }

    this.usage.set(clientName, [])
    
    // 如果 budget 存在，重新安排定时器
    const budget = this.budgets.get(clientName)
    if (budget) {
      this.scheduleReset(clientName, budget.windowMs)
    }
  }

  /**
   * 获取使用记录
   */
  getUsage(clientName: string): CallRecord[] {
    return this.getActiveRecords(clientName, Date.now())
  }

  /**
   * 获取有效记录（窗口内的记录）
   */
  private getActiveRecords(clientName: string, now: number): CallRecord[] {
    const budget = this.budgets.get(clientName)
    if (!budget) return []

    const records = this.usage.get(clientName) || []
    const windowStart = now - budget.windowMs
    return records.filter(r => r.timestamp >= windowStart)
  }

  /**
   * 安排窗口重置定时器
   */
  private scheduleReset(clientName: string, windowMs: number): void {
    const timer = setTimeout(() => {
      this.usage.set(clientName, [])
      this.timers.delete(clientName)
    }, windowMs)
    this.timers.set(clientName, timer)
  }
}