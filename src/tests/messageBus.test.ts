/**
 * MessageBus Tests
 */

import { describe, it, expect } from 'vitest'
import { MessageBus, createTaskMessage, createTagMessage, MessageTypes } from '../db/messageBus'

describe('MessageBus', () => {
  it('should create a message bus instance', () => {
    const bus = new MessageBus()
    expect(bus).toBeDefined()
  })

  it('should subscribe and receive messages', async () => {
    const bus = new MessageBus()
    const received: string[] = []

    const unsubscribe = bus.subscribe((msg: { type: string }) => {
      received.push(msg.type)
    })

    await bus.publish({ type: 'TEST', payload: {}, ts: new Date().toISOString() })
    await bus.publish({ type: 'TEST2', payload: {}, ts: new Date().toISOString() })

    // Give async queue time to process
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(received.length).toBeGreaterThanOrEqual(2)

    unsubscribe()
  })

  it('should unsubscribe from messages', async () => {
    const bus = new MessageBus()
    const received: string[] = []

    const unsubscribe = bus.subscribe((msg: { type: string }) => {
      received.push(msg.type)
    })

    await bus.publish({ type: 'TEST', payload: {}, ts: new Date().toISOString() })

    // Give async queue time to process
    await new Promise(resolve => setTimeout(resolve, 50))

    unsubscribe()

    await bus.publish({ type: 'TEST2', payload: {}, ts: new Date().toISOString() })

    // Give async queue time to process
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(received.length).toBe(1)
    expect(received[0]).toBe('TEST')
  })

  it('should create named channels', () => {
    const bus = new MessageBus()
    const channel = bus.createChannel('test-channel')

    expect(channel.name).toBe('test-channel')
    expect(typeof channel.subscribe).toBe('function')
    expect(typeof channel.publish).toBe('function')
  })

  it('should publish to named channels', () => {
    const bus = new MessageBus()
    const channel = bus.createChannel('tasks')
    const received: string[] = []

    channel.subscribe((msg: { type: string }) => {
      received.push(msg.type)
    })

    channel.publish({ type: 'TASK_ADDED', payload: {}, ts: new Date().toISOString() })

    expect(received.length).toBe(1)
    expect(received[0]).toBe('TASK_ADDED')
  })

  it('should create task messages', () => {
    const msg = createTaskMessage(MessageTypes.TASK_ADDED, 'task-123', { title: 'Test' })

    expect(msg.type).toBe('TASK_ADDED')
    expect(msg.payload.taskId).toBe('task-123')
    expect((msg.payload as { title?: string }).title).toBe('Test')
    expect(msg.ts).toBeDefined()
  })

  it('should create tag messages', () => {
    const msg = createTagMessage(MessageTypes.TAG_CREATED, 'tag-456', { name: 'Work' })

    expect(msg.type).toBe('TAG_CREATED')
    expect(msg.payload.tagId).toBe('tag-456')
    expect((msg.payload as { name?: string }).name).toBe('Work')
    expect(msg.ts).toBeDefined()
  })

  it('should handle message types', () => {
    expect(MessageTypes.TASK_ADDED).toBe('TASK_ADDED')
    expect(MessageTypes.TASK_UPDATED).toBe('TASK_UPDATED')
    expect(MessageTypes.TASK_DELETED).toBe('TASK_DELETED')
    expect(MessageTypes.TASK_COMPLETED).toBe('TASK_COMPLETED')
    expect(MessageTypes.TAG_CREATED).toBe('TAG_CREATED')
    expect(MessageTypes.TAG_UPDATED).toBe('TAG_UPDATED')
    expect(MessageTypes.TAG_DELETED).toBe('TAG_DELETED')
  })
})
