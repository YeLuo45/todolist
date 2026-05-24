/**
 * todolist V32 - SQLite + MessageBus + ToolRegistry
 * Main initialization and wiring
 */

import { initDatabase, closeDatabase } from './index'
import { isMigrated, migrateFromLegacy } from './migrations'
import { messageBus, MessageTypes, createTaskMessage } from './messageBus'
import { toolRegistry } from '../tools/registry'
import { registerFilesystemTools } from '../tools/filesystem'
import type { Task } from './schema'

export { messageBus, MessageTypes, createTaskMessage }
export { toolRegistry }
export { initDatabase, closeDatabase }

/**
 * Initialize the V32 stack
 */
export async function initV32(): Promise<void> {
  // 1. Initialize SQLite
  await initDatabase({ location: 'todolist-sqlite-db' })

  // 2. Migrate legacy data if needed
  if (!isMigrated()) {
    console.log('[V32] Migrating from legacy localStorage...')
    const result = await migrateFromLegacy()
    console.log(`[V32] Migration complete: ${result.tasks} tasks, ${result.tags} tags`)
  }

  // 3. Initialize MessageBus channels
  messageBus.createChannel('tasks')
  messageBus.createChannel('tags')

  // 4. Discover and register tools
  toolRegistry.discoverTools()
  registerFilesystemTools()

  console.log('[V32] Initialized successfully')
}

/**
 * Publish a task event to the message bus
 */
export function publishTaskEvent(type: string, task: Task): void {
  const msg = createTaskMessage(type as any, task.id, { task })
  messageBus.publish(msg)
  messageBus.publishToChannel('tasks', msg)
}

/**
 * Get all tool definitions for the LLM
 */
export function getToolDefinitions() {
  return toolRegistry.getToolDefinitions()
}

/**
 * Execute a tool by name
 */
export async function executeTool(toolName: string, args: Record<string, unknown> = {}): Promise<string> {
  return toolRegistry.execute(toolName, args)
}
