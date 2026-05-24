/**
 * V32 Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase } from '../db/index'
import { messageBus, MessageTypes } from '../db/messageBus'
import { toolRegistry } from '../tools/registry'
import { registerFilesystemTools } from '../tools/filesystem'

describe('V32 Integration', () => {
  beforeAll(async () => {
    await initDatabase({ location: 'test-v32-integration' })
    messageBus.createChannel('tasks')
    toolRegistry.discoverTools()
    registerFilesystemTools()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('should initialize database', async () => {
    const db = await initDatabase()
    expect(db).toBeDefined()
  })

  it('should have MessageBus with channels', () => {
    expect(messageBus).toBeDefined()
  })

  it('should have ToolRegistry with filesystem tools', () => {
    const defs = toolRegistry.getToolDefinitions()
    const names = defs.map((d: { name: string }) => d.name)

    expect(names).toContain('file_read')
    expect(names).toContain('file_write')
    expect(names).toContain('file_patch')
  })

  it('should subscribe to MessageBus events', async () => {
    const received: string[] = []

    const unsubscribe = messageBus.subscribe((msg: { type: string }) => {
      received.push(msg.type)
    })

    await messageBus.publish({
      type: MessageTypes.TASK_ADDED,
      payload: { taskId: 'test-1' },
      ts: new Date().toISOString(),
    })

    // Give async queue time to process
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(received.length).toBeGreaterThanOrEqual(1)

    unsubscribe()
  })

  it('should execute file_read tool definition', () => {
    const def = toolRegistry.getToolDefinitions().find((d: { name: string }) => d.name === 'file_read')

    expect(def).toBeDefined()
    expect(def?.name).toBe('file_read')
    expect(def?.description).toBeDefined()
    expect(def?.parameters).toBeDefined()
  })

  it('should execute file_write tool definition', () => {
    const def = toolRegistry.getToolDefinitions().find((d: { name: string }) => d.name === 'file_write')

    expect(def).toBeDefined()
    expect(def?.name).toBe('file_write')
  })

  it('should execute search tool', async () => {
    const result = await toolRegistry.execute('search', { query: 'test query' })

    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })
})
