/**
 * Conflict Resolution Tests
 */

import { describe, it, expect } from 'vitest'
import { resolveConflict, resolveConflictList } from '../../sync/conflict'

describe('resolveConflict', () => {
  it('should prefer local when local.updatedAt is newer', () => {
    const local = { id: '1', title: 'Local Title', updatedAt: 2000, tags: ['a'] }
    const remote = { id: '1', title: 'Remote Title', updatedAt: 1000, tags: ['b'] }

    const result = resolveConflict(local, remote)

    expect(result.title).toBe('Local Title')
    expect(result.updatedAt).toBe(2000)
  })

  it('should prefer remote when remote.updatedAt is newer', () => {
    const local = { id: '1', title: 'Local Title', updatedAt: 500, tags: [] }
    const remote = { id: '1', title: 'Remote Title', updatedAt: 3000, tags: [] }

    const result = resolveConflict(local, remote)

    expect(result.title).toBe('Remote Title')
    expect(result.updatedAt).toBe(3000)
  })

  it('should merge and deduplicate tags from both versions', () => {
    const local = { id: '1', title: 'L', updatedAt: 2000, tags: ['work', 'urgent'] }
    const remote = { id: '1', title: 'R', updatedAt: 1000, tags: ['work', 'home'] }

    const result = resolveConflict(local, remote)

    // Tags merged and deduplicated (case-insensitive dedup)
    expect(result.tags).toContain('work')
    expect(result.tags).toContain('urgent')
    expect(result.tags).toContain('home')
    // No duplicates
    const workCount = result.tags!.filter(t => t.toLowerCase() === 'work').length
    expect(workCount).toBe(1)
  })

  it('should handle missing updatedAt as 0', () => {
    const local = { id: '1', title: 'Local' } as { id: string; title: string; updatedAt?: number }
    const remote = { id: '1', title: 'Remote', updatedAt: 9999 }

    const result = resolveConflict(local, remote)
    expect(result.title).toBe('Remote')
  })

  it('should handle both missing updatedAt', () => {
    const local = { id: '1', title: 'Local' } as { id: string; title: string; updatedAt?: number }
    const remote = { id: '1', title: 'Remote' } as { id: string; title: string; updatedAt?: number }

    const result = resolveConflict(local, remote)
    // Should prefer local when equal (local default 0 >= remote default 0)
    expect(result.title).toBe('Local')
  })

  it('should handle empty tags arrays', () => {
    const local = { id: '1', title: 'L', updatedAt: 100, tags: [] }
    const remote = { id: '1', title: 'R', updatedAt: 200, tags: ['x'] }

    const result = resolveConflict(local, remote)
    expect(result.tags).toContain('x')
  })

  it('should deduplicate case-insensitively', () => {
    const local = { id: '1', title: 'L', updatedAt: 100, tags: ['Work', 'WORK'] }
    const remote = { id: '1', title: 'R', updatedAt: 200, tags: ['work', 'wOrK'] }

    const result = resolveConflict(local, remote)
    // Only one variant of 'work' should survive
    const workTags = result.tags!.filter(t => t.toLowerCase() === 'work')
    expect(workTags.length).toBe(1)
  })
})

describe('resolveConflictList', () => {
  it('should resolve multiple conflicts', () => {
    const items = [
      { local: { id: '1', title: 'L1', updatedAt: 100, tags: ['a'] }, remote: { id: '1', title: 'R1', updatedAt: 200, tags: ['b'] } },
      { local: { id: '2', title: 'L2', updatedAt: 300, tags: [] }, remote: { id: '2', title: 'R2', updatedAt: 100, tags: [] } },
    ]

    const results = resolveConflictList(items)

    expect(results[0].title).toBe('R1') // remote newer
    expect(results[1].title).toBe('L2') // local newer
    expect(results[0].tags).toContain('a')
    expect(results[0].tags).toContain('b')
  })
})