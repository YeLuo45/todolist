/**
 * Conflict resolution utilities for offline-first sync
 * Implements last-write-wins for mutable fields
 * Merges tags (dedup) for read-only accumulative fields
 */

export interface Timestamped {
  updatedAt?: number
}

export interface Tagged {
  tags?: string[]
}

/**
 * Resolve conflict between local and remote versions
 * - For mutable fields: last-write-wins based on updatedAt timestamp
 * - For tags: merge and deduplicate (read-only accumulative field)
 */
export function resolveConflict<T extends Timestamped & Tagged>(
  local: T,
  remote: T
): T {
  const localTs = local.updatedAt ?? 0
  const remoteTs = remote.updatedAt ?? 0

  // Last-write-wins for the base object
  const winner = localTs >= remoteTs ? local : remote

  // Merge tags from both versions (deduplicate)
  const localTags = local.tags ?? []
  const remoteTags = remote.tags ?? []
  const mergedTags = deduplicateTags([...localTags, ...remoteTags])

  return {
    ...winner,
    tags: mergedTags,
  }
}

/**
 * Deduplicate tags case-insensitively, preserving order
 */
function deduplicateTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of tags) {
    const lower = tag.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      result.push(tag)
    }
  }
  return result
}

/**
 * Resolve a list of conflicting items, returning the resolved version of each
 */
export function resolveConflictList<T extends Timestamped & Tagged>(
  items: { local: T; remote: T }[]
): T[] {
  return items.map(({ local, remote }) => resolveConflict(local, remote))
}