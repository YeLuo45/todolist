/**
 * PowerSync Delta Sync Engine
 * Records local changes and generates/applies deltas for synchronization
 * Uses vector clock for causal ordering
 */

import { SQLiteStore } from '../db/sqlite-store'
import { resolveConflict } from './conflict'

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE'

export interface ChangeRecord {
  table: string
  operation: SyncOperation
  id: string
  data: Record<string, unknown>
  timestamp: number
}

export interface SyncDelta {
  clientId: string
  vectorClock: number
  changes: ChangeRecord[]
  timestamp: number
}

export class PowerSync {
  private localStore: SQLiteStore
  private clientId: string
  private vectorClock: number = 0
  private pendingOps: ChangeRecord[] = []

  constructor(localStore: SQLiteStore, clientId: string = 'client') {
    this.localStore = localStore
    this.clientId = clientId
  }

  /**
   * Get the current vector clock value
   */
  getVectorClock(): number {
    return this.vectorClock
  }

  /**
   * Set the vector clock (e.g., after receiving remote state)
   */
  setVectorClock(vc: number): void {
    if (vc >= this.vectorClock) {
      this.vectorClock = vc
    }
  }

  /**
   * Record a local change operation
   */
  recordOp(op: ChangeRecord): void {
    this.pendingOps.push({
      ...op,
      timestamp: Date.now(),
    })
  }

  /**
   * Get all pending operations
   */
  getPendingOps(): ChangeRecord[] {
    return [...this.pendingOps]
  }

  /**
   * Generate a SyncDelta from pending operations
   * Note: caller should call clearPendingOps() after successful sync transmission
   */
  generateDelta(): SyncDelta {
    this.vectorClock++
    const delta: SyncDelta = {
      clientId: this.clientId,
      vectorClock: this.vectorClock,
      changes: [...this.pendingOps],
      timestamp: Date.now(),
    }
    return delta
  }

  /**
   * Clear pending operations (call after successful sync)
   */
  clearPendingOps(): void {
    this.pendingOps = []
  }

  /**
   * Apply a remote delta, handling conflicts
   */
  async applyDelta(delta: SyncDelta): Promise<{ applied: number; conflicts: number }> {
    let applied = 0
    let conflicts = 0

    // Update vector clock to max of local and remote
    if (delta.vectorClock > this.vectorClock) {
      this.vectorClock = delta.vectorClock
    }

    for (const change of delta.changes) {
      const existing = await this.localStore.get<Record<string, unknown>>(
        `${change.table}:${change.id}`
      )

      if (change.operation === 'DELETE') {
        if (!existing) {
          // Already deleted locally, skip
          applied++
        } else {
          await this.localStore.delete(`${change.table}:${change.id}`)
          applied++
        }
        continue
      }

      if (!existing) {
        // No local version — apply directly
        await this.localStore.put(`${change.table}:${change.id}`, change.data)
        applied++
      } else {
        // Conflict — resolve it
        const resolved = resolveConflict(
          existing as { updatedAt?: number; tags?: string[] },
          change.data as { updatedAt?: number; tags?: string[] }
        )
        await this.localStore.put(`${change.table}:${change.id}`, resolved)
        applied++
        conflicts++
      }
    }

    return { applied, conflicts }
  }

  /**
   * Get all local records for a table
   */
  async getTableRecords(
    table: string
  ): Promise<{ key: string; value: Record<string, unknown> }[]> {
    return this.localStore.list(table)
  }

  /**
   * Bootstrap local state from a full snapshot
   */
  async bootstrapFromSnapshot(
    snapshot: { table: string; id: string; data: Record<string, unknown> }[]
  ): Promise<void> {
    for (const { table, id, data } of snapshot) {
      await this.localStore.put(`${table}:${id}`, data)
    }
  }

  /**
   * Export full local state as a snapshot
   */
  async exportSnapshot(): Promise<{
    table: string
    id: string
    data: Record<string, unknown>
  }[]> {
    const allRecords = await this.localStore.getAll<Record<string, unknown>>()
    return allRecords.map(({ key, value }) => {
      const [table, ...idParts] = key.split(':')
      return {
        table,
        id: idParts.join(':'),
        data: value,
      }
    })
  }
}